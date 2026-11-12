'use strict';

const TAB_NAMES = ['overview', 'schedules', 'drivers', 'vehicles', 'history'];
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
        vehicles: 'Quản lý Xe',
        history: 'Lịch sử ra/vào'
    };
    if ($('page-title')) $('page-title').textContent = titles[tab];
    if (tab === 'history') loadAccessHistory();
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

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
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
    const container = $('notes-container');
    if (!container) return;
    container.innerHTML = notes.length ? notes.map((note) => {
        const isArrival = String(note.content || '').startsWith('Vào bến');
        const icon = isArrival ? 'fa-arrow-right-to-bracket' : 'fa-arrow-right-from-bracket';
        return `<div class="gate-note">
            <div class="gate-note-icon"><i class="fa-solid ${icon}"></i></div>
            <div class="gate-note-content">
                <div class="gate-note-title">${escapeHtml(note.title)}</div>
                <div class="gate-note-detail">${escapeHtml(note.content)}</div>
            </div>
        </div>`;
    }).join('') : '<div class="local-text-xs local-text-slate-500 local-p-4 local-bg-slate-50 local-rounded-lg">Chưa có lượt ra/vào nào được ghi nhận.</div>';
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
        $('kpi-completed').textContent = data.kpi.completed_schedules ?? 0;
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

let historyImageRecords = new Map();

async function loadAccessHistory() {
    const tbody = $('access-history-list');
    if (!tbody) return;
    historyImageRecords.clear();
    tbody.innerHTML = '<tr><td colspan="8" class="local-p-4 local-text-center">Đang tải lịch sử...</td></tr>';
    const params = new URLSearchParams({limit: '100'});
    const from = $('history-from')?.value || '';
    const to = $('history-to')?.value || '';
    const gate = $('history-gate')?.value || '';
    const decision = $('history-decision')?.value || '';
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (gate) params.set('gate', gate);
    if (decision) params.set('decision', decision);
    try {
        const data = await requestJson('/api/access-history?' + params.toString());
        if (!data.items?.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="local-p-4 local-text-center local-text-slate-400">Chưa có dữ liệu phù hợp.</td></tr>';
            return;
        }
        tbody.innerHTML = data.items.map((item) => {
            const allowed = item.decision === 'ALLOW' || item.status === 'SUCCESS';
            const gateLabel = item.event_type === 'OUT' ? 'Xuất bến' : item.event_type === 'IN' ? 'Về bãi' : 'Không rõ';
            const time = item.scan_time ? new Date(item.scan_time).toLocaleString('vi-VN') : '---';
            const images = item.face_image_url || item.plate_image_url
                ? '<button type="button" class="history-image-open" data-history-id="' + Number(item.id) + '">Xem ảnh</button>'
                : '<span class="local-text-slate-400">Không có</span>';
            return `<tr>
                <td class="local-p-2">${escapeHtml(time)}</td>
                <td class="local-p-2">${escapeHtml(item.driver_name || item.driver_code || 'Không nhận diện')}</td>
                <td class="local-p-2 local-font-semibold">${escapeHtml(item.plate || '---')}</td>
                <td class="local-p-2">${gateLabel}</td>
                <td class="local-p-2">${escapeHtml(item.rfid_uid || '---')} / ${escapeHtml(item.tx || '---')}</td>
                <td class="local-p-2"><span class="${allowed ? 'local-text-emerald-700' : 'local-text-red-600'} local-font-bold">${allowed ? 'CHO PHÉP' : 'TỪ CHỐI'}</span><div>${escapeHtml(item.status || '')}</div></td>
                <td class="local-p-2">${images}</td>
                <td class="local-p-2">${escapeHtml(item.message || '')}<div class="local-text-slate-400">${escapeHtml(item.plate_source || '')}</div></td>
            </tr>`;
        }).join('');
        // Store only URLs from the current rendered page; no inline JS with untrusted data.
        historyImageRecords = new Map(data.items.map(item => [Number(item.id), {
            face: item.face_image_url || null,
            plate: item.plate_image_url || null
        }]));
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="8" class="local-p-4 local-text-center local-text-red-600">' + escapeHtml(error.message) + '</td></tr>';
    }
}


function showHistoryImages(faceUrl, plateUrl) {
    const modal = $('history-image-modal');
    if (!modal) return;
    const setImage = (kind, url) => {
        const image = $('history-' + kind + '-image');
        const message = $('history-' + kind + '-message');
        if (!image || !message) return;
        image.onload = null;
        image.onerror = null;
        image.hidden = true;
        image.removeAttribute('src');
        message.hidden = false;
        message.textContent = url ? 'Đang tải ảnh...' : 'Không có ảnh';
        if (url) {
            image.onload = () => {
                image.hidden = false;
                message.hidden = true;
            };
            image.onerror = () => {
                image.hidden = true;
                message.hidden = false;
                message.textContent = 'Không tải được ảnh. Vui lòng kiểm tra Cloudinary.';
            };
            image.src = url;
        }
    };
    setImage('face', faceUrl);
    setImage('plate', plateUrl);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('history-image-lock');
    $('history-image-modal')?.querySelector('.history-image-close')?.focus();
}

function closeHistoryImages() {
    const modal = $('history-image-modal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('history-image-lock');
    for (const kind of ['face', 'plate']) {
        const image = $('history-' + kind + '-image');
        if (image) {
            image.onload = null;
            image.onerror = null;
            image.removeAttribute('src');
            image.hidden = true;
        }
    }
}

document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-history-id]');
    if (button) {
        const row = historyImageRecords.get(Number(button.dataset.historyId));
        if (row) showHistoryImages(row.face, row.plate);
    }
    if (event.target.id === 'history-image-modal') closeHistoryImages();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('history-image-modal')?.hidden) {
        closeHistoryImages();
    }
});

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
    $('add-schedule-form').addEventListener('submit', (event) => {
    const departure = $('schedule-dep-time').value;
    const returnTime = $('schedule-ret-time').value;

    submitJsonForm(event, '/api/schedules', {
        driver_id: $('schedule-driver-id').value,
        vehicle_id: $('schedule-vehicle-id').value,
        departure_time: departure ? departure.replace('T', ' ') : '',
        return_time: returnTime ? returnTime.replace('T', ' ') : ''
    }, 'Đã tạo lịch trình thành công!');
    });

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
