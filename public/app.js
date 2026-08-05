// Cấu hình worker cho pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const fullNameInput = document.getElementById('fullName');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileTableBody = document.getElementById('fileTableBody');
const fileListContainer = document.getElementById('fileListContainer');
const totalPagesEl = document.getElementById('totalPages');
const totalPriceEl = document.getElementById('totalPrice');
const uploadBtn = document.getElementById('uploadBtn');
const loading = document.getElementById('loading');

let selectedFiles = []; // Mảng chứa { file: File, pages: Number }

// 1. Quản lý LocalStorage cho Họ Tên
document.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('userName');
    if (savedName) fullNameInput.value = savedName;
});

fullNameInput.addEventListener('input', (e) => {
    localStorage.setItem('userName', e.target.value);
});

// 2. Xử lý Dropzone & Chọn file
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('bg-blue-200'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('bg-blue-200'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('bg-blue-200');
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// 3. Hàm xử lý file, đếm trang và cập nhật UI
async function handleFiles(files) {
    if (files.length === 0) return;
    
    fileListContainer.classList.remove('hidden');
    selectedFiles = [];
    fileTableBody.innerHTML = '';
    
    let totalPages = 0;

    for (const file of files) {
        let pages = 0;
        
        // Thêm row tạm thời hiển thị "Đang đếm..."
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="p-3 border truncate max-w-xs" title="${file.name}">${file.name}</td>
                        <td class="p-3 border text-center" id="page-count-${file.name.replace(/\s+/g, '')}">Đang tính...</td>`;
        fileTableBody.appendChild(tr);

        // Đếm trang tùy theo loại file
        if (file.type === 'application/pdf') {
            pages = await countPdfPages(file);
        } else if (file.name.endsWith('.docx')) {
            pages = await countDocxPages(file);
        } else if (file.type.startsWith('image/')) {
            pages = 0; // Ảnh không tính số trang (hoặc tùy logic của bạn)
        }

        selectedFiles.push({ file, pages });
        totalPages += pages;

        // Cập nhật lại số trang trên UI
        document.getElementById(`page-count-${file.name.replace(/\s+/g, '')}`).textContent = pages === 0 ? '-' : pages;
    }

    // 4. Tính toán tổng số trang và thành tiền
    totalPagesEl.textContent = totalPages;
    // Công thức: Thành tiền = Math.floor(Tổng số trang / 4)
    const price = Math.floor(totalPages / 4);
    totalPriceEl.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// Hàm đếm trang PDF
async function countPdfPages(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        return pdf.numPages;
    } catch (e) {
        console.error("Lỗi đếm trang PDF", e);
        return 1;
    }
}

// Hàm đếm trang DOCX (Bằng cách đọc file app.xml bên trong file ZIP của word)
async function countDocxPages(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const appXml = await zip.file("docProps/app.xml").async("string");
        
        // Dùng regex để bóc tách thẻ <Pages>
        const match = appXml.match(/<Pages>(\d+)<\/Pages>/);
        if (match && match[1]) {
            return parseInt(match[1], 10);
        }
        return 1; // Mặc định nếu không đọc được
    } catch (e) {
        console.error("Lỗi đếm trang DOCX", e);
        return 1;
    }
}

// 5. Submit Upload
uploadBtn.addEventListener('click', async () => {
    const name = fullNameInput.value.trim();
    if (!name) return alert('Vui lòng nhập Họ và Tên!');
    if (selectedFiles.length === 0) return alert('Vui lòng chọn ít nhất 1 tệp!');

    uploadBtn.disabled = true;
    loading.classList.remove('hidden');
    
    const formData = new FormData();
    formData.append('fullName', name);
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
            alert('Tải lên thành công!');
            // Reset form
            selectedFiles = [];
            fileTableBody.innerHTML = '';
            fileListContainer.classList.add('hidden');
            fileInput.value = '';
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
