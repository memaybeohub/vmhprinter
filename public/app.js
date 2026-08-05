pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// ==========================================
// A. LOGIC MÁY IN
// ==========================================
const fullNameInput = document.getElementById('fullName');
const deliveryTimeInput = document.getElementById('deliveryTime');
const coordinatesInput = document.getElementById('coordinates');
const getLocationBtn = document.getElementById('getLocationBtn');

document.addEventListener('DOMContentLoaded', () => {
    // Load Name & Email
    if (localStorage.getItem('userName')) fullNameInput.value = localStorage.getItem('userName');
    if (localStorage.getItem('cloudEmail')) document.getElementById('cloudEmail').value = localStorage.getItem('cloudEmail');
    
    // Default Time
    const today = new Date();
    deliveryTimeInput.placeholder = `18H chiều nay (${today.getDate()}/${today.getMonth() + 1})`;
    
    // Load History Cloud
    renderCloudHistory();
});

fullNameInput.addEventListener('input', (e) => localStorage.setItem('userName', e.target.value));

getLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ vị trí.");
    getLocationBtn.textContent = "...";
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            coordinatesInput.value = `${pos.coords.latitude}, ${pos.coords.longitude}`;
            getLocationBtn.textContent = "Đã lấy ✓";
            document.getElementById('locationError').classList.add('hidden');
        },
        () => {
            getLocationBtn.textContent = "Lỗi";
            document.getElementById('locationError').classList.remove('hidden');
        }
    );
});

// Dropzone In Ấn
let selectedPrintFiles = [];
let currentTotalPrice = 0;
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('drop', (e) => { e.preventDefault(); handlePrintFiles(e.dataTransfer.files); });
dropzone.addEventListener('dragover', (e) => e.preventDefault());
fileInput.addEventListener('change', (e) => handlePrintFiles(e.target.files));

async function handlePrintFiles(files) {
    if (files.length === 0) return;
    document.getElementById('fileListContainer').classList.remove('hidden');
    selectedPrintFiles = [];
    document.getElementById('fileTableBody').innerHTML = '';
    let totalPages = 0;

    for (const file of files) {
        let pages = 0;
        const tr = document.createElement('tr');
        const safeId = file.name.replace(/[^a-zA-Z0-9]/g, '');
        tr.innerHTML = `<td class="p-2 border truncate max-w-[150px]">${file.name}</td><td class="p-2 border text-center" id="pc-${safeId}">...</td>`;
        document.getElementById('fileTableBody').appendChild(tr);

        if (file.type === 'application/pdf') {
            try { const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise; pages = pdf.numPages; } catch(e){ pages=1; }
        } else if (file.name.endsWith('.docx')) {
            try { 
                const zip = await JSZip.loadAsync(await file.arrayBuffer());
                const match = (await zip.file("docProps/app.xml").async("string")).match(/<Pages>(\d+)<\/Pages>/);
                if (match) pages = parseInt(match[1], 10);
            } catch(e){ pages=1; }
        } else { pages = 1; }

        selectedPrintFiles.push({ file, pages });
        totalPages += pages;
        document.getElementById(`pc-${safeId}`).textContent = pages;
    }
    document.getElementById('totalPages').textContent = totalPages;
    currentTotalPrice = Math.floor(totalPages / 4) * 1000;
    document.getElementById('totalPrice').textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(currentTotalPrice);
}

document.getElementById('uploadBtn').addEventListener('click', () => {
    if (!fullNameInput.value.trim() || !coordinatesInput.value.trim() || selectedPrintFiles.length === 0) return alert('Vui lòng điền đủ thông tin, vị trí và chọn file!');
    
    const formData = new FormData();
    formData.append('fullName', fullNameInput.value.trim());
    formData.append('coordinates', coordinatesInput.value.trim());
    formData.append('deliveryTime', deliveryTimeInput.value.trim() || deliveryTimeInput.placeholder);
    selectedPrintFiles.forEach(obj => formData.append('files', obj.file));

    uploadWithProgress(formData, '/api/upload', 'loading', 'progressBar', 'uploadPercentage', 'uploadSpeed', 'uploadTime', 'uploadStatus', () => {
        alert('Gửi in thành công!');
        document.getElementById('fileListContainer').classList.add('hidden');
        selectedPrintFiles = [];
    });
});

// ==========================================
// B. LOGIC ĐÁM MÂY MINI
// ==========================================
const cloudEmailInput = document.getElementById('cloudEmail');
const cloudDropzone = document.getElementById('cloudDropzone');
const cloudFileInput = document.getElementById('cloudFileInput');
const cloudSelectedFilesText = document.getElementById('cloudSelectedFiles');
const cloudUploadBtn = document.getElementById('cloudUploadBtn');
let selectedCloudFiles = [];

cloudEmailInput.addEventListener('input', (e) => localStorage.setItem('cloudEmail', e.target.value));

cloudDropzone.addEventListener('click', () => cloudFileInput.click());
cloudDropzone.addEventListener('drop', (e) => { e.preventDefault(); handleCloudFiles(e.dataTransfer.files); });
cloudDropzone.addEventListener('dragover', (e) => e.preventDefault());
cloudFileInput.addEventListener('change', (e) => handleCloudFiles(e.target.files));

function handleCloudFiles(files) {
    if (files.length === 0) return;
    selectedCloudFiles = Array.from(files);
    cloudSelectedFilesText.textContent = `Đã chọn ${files.length} tệp.`;
    cloudUploadBtn.classList.remove('hidden');
}

cloudUploadBtn.addEventListener('click', () => {
    const formData = new FormData();
    formData.append('email', cloudEmailInput.value.trim());
    selectedCloudFiles.forEach(f => formData.append('files', f));

    uploadWithProgress(formData, '/api/cloud-upload', 'cloudLoading', 'cloudProgressBar', 'cloudPercentage', 'cloudSpeed', 'cloudTime', 'cloudStatus', (res) => {
        alert('Đã lưu lên Đám Mây!');
        saveToHistory(res.files);
        cloudSelectedFilesText.textContent = '';
        cloudUploadBtn.classList.add('hidden');
        selectedCloudFiles = [];
    });
});

// ==========================================
// C. HÀM DÙNG CHUNG & LỊCH SỬ
// ==========================================
function uploadWithProgress(formData, url, loadingId, barId, percentId, speedId, timeId, statusId, onSuccess) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    
    document.getElementById(loadingId).classList.remove('hidden');
    document.getElementById(statusId).textContent = 'Đang tải lên...';
    
    let lastTime = Date.now(), lastLoaded = 0;

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            document.getElementById(barId).style.width = percent + '%';
            document.getElementById(percentId).textContent = percent + '%';

            const now = Date.now();
            const diff = (now - lastTime) / 1000;
            if (diff >= 0.5) {
                const speed = (e.loaded - lastLoaded) / diff;
                document.getElementById(speedId).textContent = (speed / 1048576).toFixed(2) + ' MB/s';
                document.getElementById(timeId).textContent = 'Còn lại: ~' + Math.round((e.total - e.loaded) / speed) + 's';
                lastTime = now; lastLoaded = e.loaded;
            }
            if (percent === 100) {
                document.getElementById(statusId).textContent = 'Hệ thống đang xử lý, vui lòng chờ...';
                document.getElementById(speedId).textContent = '';
                document.getElementById(timeId).textContent = '';
            }
        }
    };

    xhr.onload = () => {
        document.getElementById(loadingId).classList.add('hidden');
        if (xhr.status === 200) {
            onSuccess(JSON.parse(xhr.responseText));
        } else {
            alert('Có lỗi xảy ra: ' + xhr.responseText);
        }
    };
    xhr.send(formData);
}

// Logic Lịch sử LocalStorage
function saveToHistory(newFiles) {
    let history = JSON.parse(localStorage.getItem('cloudHistory') || '[]');
    history = [...newFiles, ...history]; // Đưa file mới lên đầu
    localStorage.setItem('cloudHistory', JSON.stringify(history));
    renderCloudHistory();
}

function renderCloudHistory() {
    const history = JSON.parse(localStorage.getItem('cloudHistory') || '[]');
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td class="text-gray-400 italic py-2">Chưa có file nào được tải lên máy này.</td></tr>';
        return;
    }

    history.forEach((file, index) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-gray-50';
        tr.innerHTML = `
            <td class="py-3 pr-2">
                <p class="font-medium text-gray-800 truncate max-w-[150px] md:max-w-xs" title="${file.name}">${file.name}</p>
                <p class="text-xs text-gray-400">${file.date}</p>
            </td>
            <td class="py-3 text-right space-x-1 whitespace-nowrap">
                <button onclick="copyLink('${file.link}')" class="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs">Copy Link</button>
                <button onclick="makePublic('${file.id}', this)" class="px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs">Bật C.Khai</button>
                <button onclick="deleteFile('${file.id}', ${index})" class="px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs">Xóa</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function copyLink(link) {
    navigator.clipboard.writeText(link).then(() => alert('Đã copy link!'));
}

function makePublic(fileId, btn) {
    btn.textContent = 'Đang bật...';
    btn.disabled = true;
    fetch('/api/cloud-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
    }).then(res => {
        if(res.ok) { btn.textContent = 'Đã mở C.Khai'; btn.classList.replace('bg-green-100', 'bg-gray-100'); }
        else { btn.textContent = 'Lỗi'; btn.disabled = false; }
    });
}

function deleteFile(fileId, index) {
    if (!confirm('Bạn có chắc muốn xóa vĩnh viễn file này trên Drive?')) return;
    
    fetch('/api/cloud-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
    }).then(res => {
        if(res.ok) {
            let history = JSON.parse(localStorage.getItem('cloudHistory'));
            history.splice(index, 1);
            localStorage.setItem('cloudHistory', JSON.stringify(history));
            renderCloudHistory();
        } else {
            alert('Lỗi xóa file!');
        }
    });
}
