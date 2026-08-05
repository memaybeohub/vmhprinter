pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const fullNameInput = document.getElementById('fullName');
const coordinatesInput = document.getElementById('coordinates');
const getLocationBtn = document.getElementById('getLocationBtn');
const locationError = document.getElementById('locationError');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileTableBody = document.getElementById('fileTableBody');
const fileListContainer = document.getElementById('fileListContainer');
const totalPagesEl = document.getElementById('totalPages');
const totalPriceEl = document.getElementById('totalPrice');
const uploadBtn = document.getElementById('uploadBtn');
const loading = document.getElementById('loading');

let selectedFiles = [];

// 1. Quản lý LocalStorage cho Họ Tên
document.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('userName');
    if (savedName) fullNameInput.value = savedName;
});

fullNameInput.addEventListener('input', (e) => {
    localStorage.setItem('userName', e.target.value);
});

// 2. Logic Lấy Toạ Độ (GPS)
getLocationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        getLocationBtn.textContent = "Đang lấy...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                coordinatesInput.value = `${lat}, ${lng}`;
                getLocationBtn.textContent = "Đã lấy ✓";
                getLocationBtn.classList.replace('bg-green-600', 'bg-gray-600');
                getLocationBtn.classList.replace('hover:bg-green-700', 'hover:bg-gray-700');
                locationError.classList.add('hidden');
            },
            (error) => {
                console.error(error);
                getLocationBtn.textContent = "Lấy vị trí";
                locationError.classList.remove('hidden');
            },
            { enableHighAccuracy: true } // Yêu cầu độ chính xác cao
        );
    } else {
        alert("Trình duyệt của bạn không hỗ trợ lấy vị trí.");
    }
});

// 3. Xử lý Dropzone & Chọn file
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('bg-blue-200'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('bg-blue-200'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('bg-blue-200');
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// 4. Hàm xử lý file và đếm trang
async function handleFiles(files) {
    if (files.length === 0) return;
    
    fileListContainer.classList.remove('hidden');
    selectedFiles = [];
    fileTableBody.innerHTML = '';
    
    let totalPages = 0;

    for (const file of files) {
        let pages = 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="p-3 border truncate max-w-xs" title="${file.name}">${file.name}</td>
                        <td class="p-3 border text-center" id="page-count-${file.name.replace(/[^a-zA-Z0-9]/g, '')}">Đang tính...</td>`;
        fileTableBody.appendChild(tr);

        if (file.type === 'application/pdf') {
            pages = await countPdfPages(file);
        } else if (file.name.endsWith('.docx')) {
            pages = await countDocxPages(file);
        } else if (file.type.startsWith('image/')) {
            pages = 1; // ẢNH NAY ĐÃ TÍNH LÀ 1 TRANG
        }

        selectedFiles.push({ file, pages });
        totalPages += pages;

        document.getElementById(`page-count-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`).textContent = pages;
    }

    totalPagesEl.textContent = totalPages;
    
    // CẬP NHẬT CÁCH TÍNH TIỀN: Nhân 1000 để ra nghìn đồng
    const price = Math.floor(totalPages / 4) * 1000;
    // Format thành dạng: 25.000 ₫
    totalPriceEl.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

async function countPdfPages(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        return pdf.numPages;
    } catch (e) { return 1; }
}

async function countDocxPages(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const appXml = await zip.file("docProps/app.xml").async("string");
        const match = appXml.match(/<Pages>(\d+)<\/Pages>/);
        if (match && match[1]) return parseInt(match[1], 10);
        return 1;
    } catch (e) { return 1; }
}

// 5. Submit Upload
uploadBtn.addEventListener('click', async () => {
    const name = fullNameInput.value.trim();
    const coords = coordinatesInput.value.trim();

    if (!name) return alert('Vui lòng nhập Họ và Tên!');
    if (!coords) return alert('Vui lòng bấm nút "Lấy vị trí" để lấy toạ độ giao hàng!');
    if (selectedFiles.length === 0) return alert('Vui lòng chọn ít nhất 1 tệp!');

    uploadBtn.disabled = true;
    loading.classList.remove('hidden');
    
    const formData = new FormData();
    formData.append('fullName', name);
    formData.append('coordinates', coords); // Gửi toạ độ lên server
    selectedFiles.forEach(obj => {
        formData.append('files', obj.file);
    });

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        
        if (response.ok) {
            alert('Tải lên thành công! Cửa hàng đã nhận được yêu cầu của bạn.');
            selectedFiles = [];
            fileTableBody.innerHTML = '';
            fileListContainer.classList.add('hidden');
            fileInput.value = '';
            coordinatesInput.value = '';
            getLocationBtn.textContent = "Lấy vị trí";
            getLocationBtn.classList.replace('bg-gray-600', 'bg-green-600');
            getLocationBtn.classList.replace('hover:bg-gray-700', 'hover:bg-green-700');
        } else {
            alert('Lỗi: ' + result.message);
        }
    } catch (error) {
        alert('Lỗi kết nối đến máy chủ!');
    } finally {
        uploadBtn.disabled = false;
        loading.classList.add('hidden');
    }
});
