        let capturedImages = [null, null, null];
        let currentStep = 0;
        let mediaStream = null;
        let isDropdownPopulated = false;

        function switchTab(tab) {
            ['overview', 'schedules', 'drivers', 'vehicles'].forEach(t => {
                document.getElementById(`view-${t}`).classList.add('local-hidden');
                document.getElementById(`nav-${t}`).className = "sidebar-nav-link";
            });
            document.getElementById(`view-${tab}`).classList.remove('local-hidden');
            document.getElementById(`nav-${tab}`).className = "sidebar-nav-link is-active";
        }

        async function openCameraModal() {
            document.getElementById('camera-modal').classList.remove('local-hidden');
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
                document.getElementById('webcam').srcObject = mediaStream;
            } catch (err) { alert("Không thể mở Camera!"); }
        }

        function closeCameraModal() {
            if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
            document.getElementById('camera-modal').classList.add('local-hidden');
        }

        function captureNextAngle() {
            if (currentStep >= 3) return;
            const video = document.getElementById('webcam');
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const b64Img = canvas.toDataURL('image/jpeg');
            capturedImages[currentStep] = b64Img;

            const camBox = document.getElementById('cam-box');
            camBox.classList.add('flash-capture');
            setTimeout(() => camBox.classList.remove('flash-capture'), 300);

            document.getElementById(`prev-${currentStep + 1}`).src = b64Img;
            currentStep++;

            const btn = document.getElementById('btn-capture-step');
            const guide = document.getElementById('guide-text');

            if (currentStep === 1) {
                guide.innerText = "2. Quay mặt NGHIÊNG TRÁI nhẹ";
                btn.innerHTML = '<i class="fa-solid fa-camera"></i><span>Chụp Frame 2 (Nghiêng Trái)</span>';
            } else if (currentStep === 2) {
                guide.innerText = "3. Quay mặt NGHIÊNG PHẢI nhẹ";
                btn.innerHTML = '<i class="fa-solid fa-camera"></i><span>Chụp Frame 3 (Nghiêng Phải)</span>';
            } else if (currentStep === 3) {
                guide.innerText = "✅ Đã thu thập đủ 3 góc mặt!";
                btn.className = "local-bg-emerald-600 local-text-white local-px-5 local-py-2 local-rounded-xl local-text-xs local-font-bold";
                btn.innerText = "Hoàn Tất Quét Khuôn Mặt";
                document.getElementById('face-status-badge').className = "local-text-xs local-bg-emerald-100 local-text-emerald-800 local-px-3 local-py-1 local-rounded-full local-font-bold";
                document.getElementById('face-status-badge').innerText = "✅ Đã thu thập đủ 3 góc khuôn mặt";
                setTimeout(closeCameraModal, 1000);
            }
        }

        
        function resetCapture() {
            capturedImages = [null, null, null];
            currentStep = 0;
            [1, 2, 3].forEach(i => {
                document.getElementById(`prev-${i}`).src = '';
            });
            document.getElementById('guide-text').innerText ='1. Nhìn THẲNG vào camera';
            const btn = document.getElementById('btn-capture-step');
            btn.disabled = false;
            btn.className =
                'local-bg-blue-600 local-hover-bg-blue-700 local-text-white local-px-5 local-py-2 local-rounded-xl local-text-xs local-font-bold local-flex local-items-center local-space-x-2';
            btn.innerHTML =
                '<i class="fa-solid fa-camera"></i><span>Chụp Frame 1 (Thẳng)</span>';
            const badge = document.getElementById('face-status-badge');
            badge.className ='local-text-xs local-bg-amber-100 local-text-amber-800 local-px-3 local-py-1 local-rounded-full local-font-bold';
            badge.innerText = 'Chưa quét khuôn mặt (Cần quét 3 góc)';
        }

        async function loadData() {
            const res = await fetch('/api/dashboard');
            if (res.status === 401) { window.location.href = '/login'; return; }
            const data = await res.json();

            document.getElementById('kpi-vehicles').innerText = data.kpi.total_vehicles;
            document.getElementById('kpi-schedules').innerText = data.kpi.active_schedules;
            document.getElementById('kpi-incidents').innerText = data.kpi.total_incidents;

            // Render Ghi chú trễ giờ
            const notesContainer = document.getElementById('notes-container');
            if (data.notes.length === 0) {
                notesContainer.innerHTML = '<div class="local-text-xs local-text-slate-400 local-p-3 local-bg-slate-50 local-rounded-lg">Không có ghi chú trễ giờ nào.</div>';
            } else {
                notesContainer.innerHTML = data.notes.map(n => `
                    <div class="local-p-3 local-bg-amber-50 local-border local-border-amber-200 local-rounded-xl local-space-y-1">
                        <div class="local-text-xs local-font-bold local-text-amber-900">${n.title}</div>
                        <div class="local-text-11px local-text-amber-800">${n.content}</div>
                    </div>
                `).join('');
            }

            // Render Lịch trình sơ bộ
            document.getElementById('overview-schedules-list').innerHTML = data.schedules.slice(0, 5).map(s => `
                <tr class="local-hover-bg-slate-50">
                    <td class="local-py-3 local-font-bold local-text-slate-800">${s.driver_name}</td>
                    <td class="local-py-3 local-font-semibold local-text-blue-600">${s.vehicle_plate}</td>
                    <td class="local-py-3 local-text-slate-600">${s.departure_time} ${s.actual_dep_time ? `<span class="local-font-bold local-text-emerald-600">(${s.actual_dep_time})</span>` : ''}</td>
                    <td class="local-py-3 local-text-slate-600">${s.return_time || '---'} ${s.actual_ret_time ? `<span class="local-font-bold local-text-emerald-600">(${s.actual_ret_time})</span>` : ''}</td>
                    <td class="local-py-3"><span class="local-px-2 local-py-0-5 local-rounded-full local-text-10px local-font-bold local-bg-blue-100 local-text-blue-800">${s.status}</span></td>
                </tr>
            `).join('');

            // Selectbox
            if (!isDropdownPopulated || data.drivers.length !== document.getElementById('schedule-driver-id').children.length - 1) {
                document.getElementById('schedule-driver-id').innerHTML = '<option value="">-- Chọn tài xế --</option>' +
                    data.drivers.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
                
                document.getElementById('schedule-vehicle-id').innerHTML = '<option value="">-- Chọn xe --</option>' +
                    data.vehicles.map(v => `<option value="${v.id}">${v.plate} - ${v.vehicle_type}</option>`).join('');
                
                isDropdownPopulated = true;
            }

            // Lịch trình chi tiết
            document.getElementById('full-schedules-list').innerHTML = data.schedules.map(s => `
                <tr>
                    <td class="local-py-3 local-font-bold">${s.driver_name}</td>
                    <td class="local-py-3 local-font-semibold local-text-blue-600">${s.vehicle_plate}</td>
                    <td class="local-py-3">${s.departure_time}</td>
                    <td class="local-py-3 local-font-bold ${s.actual_dep_time > s.departure_time ? 'local-text-red-600' : 'local-text-emerald-600'}">${s.actual_dep_time || '---'}</td>
                    <td class="local-py-3">${s.return_time || '---'}</td>
                    <td class="local-py-3 local-font-bold ${s.actual_ret_time > s.return_time ? 'local-text-red-600' : 'local-text-emerald-600'}">${s.actual_ret_time || '---'}</td>
                    <td class="local-py-3"><span class="local-px-2 local-py-0-5 local-rounded-full local-text-11px local-font-semibold local-bg-blue-100 local-text-blue-800">${s.status}</span></td>
                    <td class="local-py-3 local-text-right"><button onclick="deleteSchedule(${s.id})"  style="background: transparent; border: none; outline: none; box-shadow: none; padding: 0; color: red; cursor: pointer;">Xóa</button></td>
                </tr>
            `).join('');

            // Tài xế
            document.getElementById('drivers-list').innerHTML = data.drivers.map(d => `
                <tr>
                    <td class="local-py-3 local-font-bold">${d.code}</td>
                    <td class="local-py-3">${d.name}</td>
                    <td class="local-py-3">${d.age || '---'} tuổi / ${d.gender}</td>
                    <td class="local-py-3">
                        <span class="local-px-2 local-py-0-5 local-rounded-full local-text-10px local-font-bold ${d.has_face ? 'local-bg-emerald-100 local-text-emerald-800' : 'local-bg-slate-100 local-text-slate-500'}">
                            ${d.has_face ? '● Đã Sync Khuôn Mặt' : 'Chưa có Face Data'}
                        </span>
                    </td>
                    <td class="local-py-3 local-text-right"><button onclick="deleteDriver(${d.id})"  style="background: transparent; border: none; outline: none; box-shadow: none; padding: 0; color: red; cursor: pointer;">Xóa</button></td>
                </tr>
            `).join('');

            // Xe
            document.getElementById('vehicles-list').innerHTML = data.vehicles.map(v => `
                <tr>
                    <td class="local-py-3 local-font-bold local-text-slate-800">${v.plate}</td>
                    <td class="local-py-3">${v.vehicle_type}</td>
                    <td class="local-py-3 local-text-right"><button onclick="deleteVehicle(${v.id})"  style="background: transparent; border: none; outline: none; box-shadow: none; padding: 0; color: red; cursor: pointer;">Xóa</button></td>
                </tr>
            `).join('');
        }

        // Submits
        document.getElementById('add-schedule-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    driver_id: document.getElementById('schedule-driver-id').value,
                    vehicle_id: document.getElementById('schedule-vehicle-id').value,
                    departure_time: document.getElementById('schedule-dep-time').value,
                    return_time: document.getElementById('schedule-ret-time').value
                })
            });
            e.target.reset();
            loadData();
        });

        document.getElementById('add-driver-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (capturedImages.some(img => !img || !img.startsWith('data:image/jpeg;base64,'))) {
                alert('Bạn phải chụp đủ 3 góc khuôn mặt trước khi lưu!');
                return;
            }
            try {
                const res = await fetch('/api/drivers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: document.getElementById('driver-code').value,
                        name: document.getElementById('driver-name').value,
                        age: document.getElementById('driver-age').value,
                        gender: document.getElementById('driver-gender').value,
                        face_images: capturedImages
                    })
                });
                const result = await res.json();
                if (!res.ok || !result.success) {
                    alert(result.message || 'Lưu tài xế thất bại!');
                    return;
                }
                alert('Đã lưu tài xế thành công!');
                e.target.reset();
                resetCapture();
                isDropdownPopulated = false;
                await loadData();
            } catch (err) {
                console.error(err);
                alert('Không thể kết nối máy chủ!');
            }
        });

        document.getElementById('add-vehicle-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await fetch('/api/vehicles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plate: document.getElementById('vehicle-plate').value,
                    vehicle_type: document.getElementById('vehicle-type').value
                })
            });
            e.target.reset();
            isDropdownPopulated = false;
            loadData();
        });

        async function deleteDriver(id) { if (confirm('Xóa tài xế này?')) { await fetch(`/api/drivers/${id}`, { method: 'DELETE' }); isDropdownPopulated = false; loadData(); } }
        async function deleteVehicle(id) { if (confirm('Xóa xe này?')) { await fetch(`/api/vehicles/${id}`, { method: 'DELETE' }); isDropdownPopulated = false; loadData(); } }
        async function deleteSchedule(id) { if (confirm('Xóa lịch trình này?')) { await fetch(`/api/schedules/${id}`, { method: 'DELETE' }); loadData(); } }

        loadData();
        setInterval(loadData, 5000);
