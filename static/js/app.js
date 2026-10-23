'use strict';

const TAB_NAMES = ['overview', 'schedules', 'drivers', 'vehicles'];
let capturedImages = [null, null, null];
let currentStep = 0;
let mediaStream = null;
let isDropdownPopulated = false;
let isLoading = false;
let refreshTimer = null;

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    });

    if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Phiên đăng nhập đã hết hạn.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Yêu cầu không thành công.');
    }
    return data;
}

function showError(error, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.') {
    console.error(error);
    alert(error?.message || fallback);
}

function switchTab(tab) {
    if (!TAB_NAMES.includes(tab)) return;
    TAB_NAMES.forEach((name) => {
        $(`view-${name}`)?.classList.toggle('local-hidden', name !== tab);
        $('nav-' + name)?.classList.toggle('is-active', name === tab);
    });
    const titles = {
        overview: 'Tổng quan hệ thống',
        schedules: 'Quản lý Lịch trình',
        drivers: 'Quản lý Tài xế',
        vehicles: 'Quản lý Xe'
    };
    if ($('page-title')) $('page-title').textContent = titles[tab];
}

async function openCameraModal() {
    $('camera-modal')?.classList.remove('local-hidden');
    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Trình duyệt không hỗ trợ camera hoặc trang chưa dùng HTTPS.');
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        $('webcam').srcObject = mediaStream;
        await $('webcam').play().catch(() => {});
    } catch (error) {
        closeCameraModal();
        showError(error, 'Không thể mở camera. Hãy kiểm tra quyền truy cập camera.');
    }
}

function closeCameraModal() {
    if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
    }
    if ($('webcam')) $('webcam').srcObject = null;
    $('camera-modal')?.classList.add('local-hidden');
}

function captureNextAngle() {
    if (currentStep >= 3) return;
    const video = $('webcam');
    if (!video || !video.videoWidth) {
        alert('Camera chưa sẵn sàng. Vui lòng chờ hình ảnh xuất hiện.');
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
        alert('Không thể xử lý ảnh từ camera.');
        return;
    }

    const image = canvas.toDataURL('image/jpeg', 0.85);
    capturedImages[currentStep] = image;
    $('cam-box')?.classList.add('flash-capture');
    window.setTimeout(() => $('cam-box')?.classList.remove('flash-capture'), 300);
    $('prev-' + (currentStep + 1)).src = image;
    currentStep += 1;

    const button = $('btn-capture-step');
    if (currentStep === 1) {
        $('guide-text').textContent = '2. Quay mặt NGHIÊNG TRÁI nhẹ';
        button.innerHTML = '<i class="fa-solid fa-camera"></i><span>Chụp Frame 2 (Nghiêng Trái)</span>';
    } else if (currentStep === 2) {
        $('guide-text').textContent = '3. Quay mặt NGHIÊNG PHẢI nhẹ';
        button.innerHTML = '<i class="fa-solid fa-camera"></i><span>Chụp Frame 3 (Nghiêng Phải)</span>';
    } else {
        $('guide-text').textContent = 'Đã thu thập đủ 3 góc mặt!';
        button.textContent = 'Đã chụp đủ 3 góc';
        button.disabled = true;
        $('face-status-badge').className =
            'local-text-xs local-bg-emerald-100 local-text-emerald-800 local-px-3 local-py-1 local-rounded-full local-font-bold';
        $('face-status-badge').textContent = 'Đã thu thập đủ 3 góc khuôn mặt';
        window.setTimeout(closeCameraModal, 800);
    }
}

function resetCapture() {
    capturedImages = [null, null, null];
    currentStep = 0;
    [1, 2, 3].forEach((index) => { $('prev-' + index).src = ''; });
    $('guide-text').textContent = '1. Nhìn THẲNG vào camera';
    const button = $('btn-capture-step');
    button.disabled = false;
    button.className =
        'local-bg-blue-600 local-hover-bg-blue-700 local-text-white local-px-5 local-py-2 local-rounded-xl local-text-xs local-font-bold local-flex local-items-center local-space-x-2';
    button.innerHTML = '<i class="fa-solid fa-camera"></i><span>Chụp Frame 1 (Thẳng)</span>';
    const badge = $('face-status-badge');
    badge.className =
        'local-text-xs local-bg-amber-100 local-text-amber-800 local-px-3 local-py-1 local-rounded-full local-font-bold';
    badge.textContent = 'Chưa quét khuôn mặt (Cần quét 3 góc)';
}

function renderSchedules(schedules) {
    $('overview-schedules-list').innerHTML = schedules.slice(0, 5).map((s) => `
        <tr class="local-hover-bg-slate-50">
            <td class="local-py-3 local-font-bold local-text-slate-800">${escapeHtml(s.driver_name)}</td>
            <td class="local-py-3 local-font-semibold local-text-blue-600">${escapeHtml(s.vehicle_plate)}</td>
            <td class="local-py-3 local-text-slate-600">${escapeHtml(s.departure_time)} ${s.actual_dep_time ? `<span class="local-font-bold local-text-emerald-600">(${escapeHtml(s.actual_dep_time)})</span>` : ''}</td>
            <td class="local-py-3 local-text-slate-600">${escapeHtml(s.return_time || '---')} ${s.actual_ret_time ? `<span class="local-font-bold local-text-emerald-600">(${escapeHtml(s.actual_ret_time)})</span>` : ''}</td>
            <td class="local-py-3"><span class="local-px-2 local-py-0-5 local-rounded-full local-text-10px local-font-bold local-bg-blue-100 local-text-blue-800">${escapeHtml(s.status)}</span></td>
        </tr>`).join('');
    $('full-schedules-list').innerHTML = schedules.map((s) => `
        <tr>
            <td class="local-py-3 local-font-bold">${escapeHtml(s.driver_name)}</td>
            <td class="local-py-3 local-font-semibold local-text-blue-600">${escapeHtml(s.vehicle_plate)}</td>
            <td class="local-py-3">${escapeHtml(s.departure_time)}</td>
            <td class="local-py-3 local-font-bold ${s.actual_dep_time && s.actual_dep_time > s.departure_time ? 'local-text-red-600' : 'local-text-emerald-600'}">${escapeHtml(s.actual_dep_time || '---')}</td>
            <td class="local-py-3">${escapeHtml(s.return_time || '---')}</td>
            <td class="local-py-3 local-font-bold ${s.actual_ret_time && s.return_time && s.actual_ret_time > s.return_time ? 'local-text-red-600' : 'local-text-emerald-600'}">${escapeHtml(s.actual_ret_time || '---')}</td>
            <td class="local-py-3"><span class="local-px-2 local-py-0-5 local-rounded-full local-text-11px local-font-semibold local-bg-blue-100 local-text-blue-800">${escapeHtml(s.status)}</span></td>
            <td class="local-py-3 local-text-right"><button type="button" class="btn-link" onclick="deleteSchedule(${Number(s.id)})">Xóa</button></td>
        </tr>`).join('');
}

function renderDrivers(drivers) {
    $('drivers-list').innerHTML = drivers.map((d) => `
        <tr>
            <td class="local-py-3 local-font-bold">${escapeHtml(d.code)}</td>
            <td class="local-py-3">${escapeHtml(d.name)}</td>
            <td class="local-py-3">${escapeHtml(d.age || '---')} tuổi / ${escapeHtml(d.gender || '---')}</td>
            <td class="local-py-3"><span class="local-px-2 local-py-0-5 local-rounded-full local-text-10px local-font-bold ${d.has_face ? 'local-bg-emerald-100 local-text-emerald-800' : 'local-bg-slate-100 local-text-slate-500'}">${d.has_face ? 'Đã Sync Khuôn Mặt' : 'Chưa có Face Data'}</span></td>
            <td class="local-py-3 local-text-right"><button type="button" class="btn-link" onclick="deleteDriver(${Number(d.id)})">Xóa</button></td>
        </tr>`).join('');
}

function renderVehicles(vehicles) {
    $('vehicles-list').innerHTML = vehicles.map((v) => `
        <tr>
            <td class="local-py-3 local-font-bold local-text-slate-800">${escapeHtml(v.plate)}</td>
            <td class="local-py-3">${escapeHtml(v.vehicle_type)}</td>
            <td class="local-py-3 local-text-right"><button type="button" class="btn-link" onclick="deleteVehicle(${Number(v.id)})">Xóa</button></td>
        </tr>`).join('');
}

function renderNotes(notes) {
    $('notes-container').innerHTML = notes.length ? notes.map((note) => `
        <div class="local-p-3 local-bg-amber-50 local-border local-border-amber-200 local-rounded-xl local-space-y-1">
            <div class="local-text-xs local-font-bold local-text-amber-900">${escapeHtml(note.title)}</div>
            <div class="local-text-11px local-text-amber-800">${escapeHtml(note.content)}</div>
        </div>`).join('') :
        '<div class="local-text-xs local-text-slate-400 local-p-3 local-bg-slate-50 local-rounded-lg">Không có ghi chú trễ giờ nào.</div>';
}

function updateSelectOptions(elementId, items, getLabel) {
    const select = $(elementId);
    const selectedValue = select.value;
    select.innerHTML = '<option value="">-- Chọn --</option>' + items.map((item) =>
        `<option value="${Number(item.id)}">${escapeHtml(getLabel(item))}</option>`).join('');
    if (items.some((item) => String(item.id) === selectedValue)) select.value = selectedValue;
}

async function loadData() {
    if (isLoading) return;
    isLoading = true;
    try {
        const data = await requestJson('/api/dashboard');
        $('kpi-vehicles').textContent = data.kpi.total_vehicles ?? 0;
        $('kpi-schedules').textContent = data.kpi.active_schedules ?? 0;
        $('kpi-incidents').textContent = data.kpi.total_incidents ?? 0;
        renderNotes(data.notes || []);
        renderSchedules(data.schedules || []);
        renderDrivers(data.drivers || []);
        renderVehicles(data.vehicles || []);

        if (!isDropdownPopulated) {
            updateSelectOptions('schedule-driver-id', data.drivers || [],
                (driver) => `${driver.name} (${driver.code})`);
            updateSelectOptions('schedule-vehicle-id', data.vehicles || [],
                (vehicle) => `${vehicle.plate} - ${vehicle.vehicle_type}`);
            isDropdownPopulated = true;
        }
    } catch (error) {
        if (error.message !== 'Phiên đăng nhập đã hết hạn.') {
            console.error('Không thể tải dữ liệu dashboard:', error);
        }
    } finally {
        isLoading = false;
    }
}

async function submitJsonForm(event, url, payload, successMessage, afterSuccess) {
    event.preventDefault();
    const submitButton = event.submitter || event.target.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
        await requestJson(url, { method: 'POST', body: JSON.stringify(payload) });
        if (successMessage) alert(successMessage);
        event.target.reset();
        if (afterSuccess) afterSuccess();
        await loadData();
    } catch (error) {
        showError(error);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    $('add-schedule-form').addEventListener('submit', (event) => submitJsonForm(
        event, '/api/schedules', {
            driver_id: $('schedule-driver-id').value,
            vehicle_id: $('schedule-vehicle-id').value,
            departure_time: $('schedule-dep-time').value,
            return_time: $('schedule-ret-time').value
        }, 'Đã tạo lịch trình thành công!'
    ));

    $('add-driver-form').addEventListener('submit', (event) => {
        event.preventDefault();
        if (capturedImages.some((image) => !image || !image.startsWith('data:image/jpeg;base64,'))) {
            alert('Bạn phải chụp đủ 3 góc khuôn mặt trước khi lưu!');
            return;
        }
        submitJsonForm(event, '/api/drivers', {
            code: $('driver-code').value,
            name: $('driver-name').value,
            age: $('driver-age').value,
            gender: $('driver-gender').value,
            face_images: capturedImages
        }, 'Đã lưu tài xế thành công!', () => {
            resetCapture();
            isDropdownPopulated = false;
        });
    });

    $('add-vehicle-form').addEventListener('submit', (event) => submitJsonForm(
        event, '/api/vehicles', {
            plate: $('vehicle-plate').value,
            vehicle_type: $('vehicle-type').value
        }, 'Đã thêm xe thành công!', () => { isDropdownPopulated = false; }
    ));

    switchTab('overview');
    loadData();
    refreshTimer = window.setInterval(loadData, 10000);
});

async function deleteRecord(url, label, refreshDropdowns = false) {
    if (!confirm(`Bạn có chắc muốn xóa ${label} này?`)) return;
    try {
        await requestJson(url, { method: 'DELETE' });
        if (refreshDropdowns) isDropdownPopulated = false;
        await loadData();
    } catch (error) {
        showError(error, 'Không thể xóa dữ liệu.');
    }
}

function deleteDriver(id) { return deleteRecord(`/api/drivers/${Number(id)}`, 'tài xế', true); }
function deleteVehicle(id) { return deleteRecord(`/api/vehicles/${Number(id)}`, 'xe', true); }
function deleteSchedule(id) { return deleteRecord(`/api/schedules/${Number(id)}`, 'lịch trình'); }
