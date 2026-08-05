pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const fullNameInput = document.getElementById('fullName');
const coordinatesInput = document.getElementById('coordinates');
const deliveryTimeInput = document.getElementById('deliveryTime');
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
let currentTotalPrice = 0;

// 1. Khởi tạo mặc định
document.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('userName');
    if (savedName) fullNameInput.value = savedName;

    const today = new Date();
    const dateStr = `${today.getDate()}/${today.getMonth() + 1}`;
    deliveryTimeInput.placeholder = `18H chiều nay (${dateStr})`;
});

fullNameInput.addEventListener('input', (e) => {
    localStorage.setItem('userName', e.target.value);
});

// 2. Logic Lấy Toạ Độ
getLocationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        getLocationBtn.textContent = "Đang lấy...";
        getLocationBtn.disabled = true; 
        getLocationBtn.classList.add('opacity-70', 'cursor-not-allowed');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                coordinatesInput.value = `${lat}, ${lng}`;
                
                getLocationBtn.textContent = "Đã lấy ✓";
                getLocationBtn.classList.remove('opacity-70', 'cursor-not-allowed');
                getLocationBtn.classList.replace('bg-green-600', 'bg-gray-600');
                getLocationBtn.classList.replace('hover:bg-green-700', 'hover:bg-gray-700');
                getLocationBtn.disabled = false;
                locationError.classList.add('hidden');
            },
            (error) => {
                console.error(error);
                getLocationBtn.textContent = "Lấy vị trí";
                getLocationBtn.classList.remove('opacity-70', 'cursor-not-allowed');
                getLocationBtn.disabled = false;
                locationError.classList.remove('hidden');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
    } else {
        alert("Trình duyệt của bạn không hỗ trợ lấy vị trí.");
    }
});

// 3. Xử lý Dropzone
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('bg-blue-200'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('bg-blue-200'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('bg-blue-200');
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// 4. Hàm đếm trang & tính tiền
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
            pages = 1;
        }

        selectedFiles.push({ file, pages });
        totalPages += pages;
        document.getElementById(`page-count-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`).textContent = pages;
    }

    totalPagesEl.textContent = totalPages;
    currentTotalPrice = Math.floor(totalPages / 4) * 1000;
    totalPriceEl.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(currentTotalPrice);
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

// 5. Submit Upload với XMLHttpRequest đo tốc độ thật
uploadBtn.addEventListener('click', () => {
    const name = fullNameInput.value.trim();
    const coords = coordinatesInput.value.trim();
    
    let delivery = deliveryTimeInput.value.trim();
    if (!delivery) {
        delivery = deliveryTimeInput.placeholder; 
    }

    if (!name) return alert('Vui lòng nhập Họ và Tên!');
    if (!coords) return alert('Vui lòng cung cấp vị trí giao hàng!');
    if (selectedFiles.length === 0) return alert('Vui lòng chọn ít nhất 1 tệp!');

    uploadBtn.disabled = true;
    loading.classList.remove('hidden');
    
    // Khởi tạo các giá trị ban đầu cho giao diện Loading
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('uploadPercentage').textContent = '0%';
    document.getElementById('uploadSpeed').textContent = '0 MB/s';
    document.getElementById('uploadTime').textContent = 'Còn lại: Đang tính...';
    document.getElementById('uploadStatus').textContent = 'Đang đẩy file lên máy chủ...';
    
    const formData = new FormData();
    formData.append('fullName', name);
    formData.append('coordinates', coords);
    formData.append('deliveryTime', delivery);
    formData.append('totalPrice', currentTotalPrice);
    
    selectedFiles.forEach(obj => {
        formData.append('files', obj.file);
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    // Các biến dùng để đo lường thời gian và dữ liệu
    let startTime = Date.now();
    let lastTime = startTime;
    let lastLoaded = 0;

    // Lắng nghe sự kiện tiến trình tải lên
    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            document.getElementById('progressBar').style.width = percentComplete + '%';
            document.getElementById('uploadPercentage').textContent = percentComplete + '%';

            const currentTime = Date.now();
            const timeDiff = (currentTime - lastTime) / 1000; // Đổi ra giây

            // Cập nhật tốc độ mỗi 0.5 giây để tránh số nhảy loạn xạ
            if (timeDiff >= 0.5) {
                const loadedDiff = e.loaded - lastLoaded; // Số Byte tải được trong chu kỳ
                const speedBps = loadedDiff / timeDiff; // Byte trên giây
                const speedMbps = (speedBps / (1024 * 1024)).toFixed(2); // Đổi ra MB/s
                
                document.getElementById('uploadSpeed').textContent = `${speedMbps} MB/s`;

                const bytesRemaining = e.total - e.loaded;
                const secondsRemaining = Math.round(bytesRemaining / speedBps);
                
                if (secondsRemaining !== Infinity && !isNaN(secondsRemaining)) {
                    document.getElementById('uploadTime').textContent = `Còn lại: ~${secondsRemaining} giây`;
                }

                lastTime = currentTime;
                lastLoaded = e.loaded;
            }

            // Khi đẩy xong 100% từ User -> Máy chủ (Render)
            if (percentComplete === 100) {
                document.getElementById('uploadStatus').textContent = 'Máy chủ đang đồng bộ lên Google Drive...';
                document.getElementById('uploadSpeed').textContent = 'Xử lý dữ liệu';
                document.getElementById('uploadTime').textContent = 'Vui lòng chờ giây lát!';
            }
        }
    };

    // Khi máy chủ phản hồi (Đã upload xong lên Drive & Bắn webhook Discord)
    xhr.onload = () => {
        if (xhr.status === 200) {
            alert('Tải lên thành công! Cửa hàng đã nhận được yêu cầu của bạn.');
            // Reset Form
            selectedFiles = [];
            currentTotalPrice = 0;
            fileTableBody.innerHTML = '';
            fileListContainer.classList.add('hidden');
            fileInput.value = '';
            
            coordinatesInput.value = '';
            getLocationBtn.textContent = "Lấy vị trí";
            getLocationBtn.classList.replace('bg-gray-600', 'bg-green-600');
            getLocationBtn.classList.replace('hover:bg-gray-700', 'hover:bg-green-700');
        } else {
            let errorMsg = 'Lỗi không xác định từ máy chủ.';
            try {
                const res = JSON.parse(xhr.responseText);
                errorMsg = res.message;
            } catch(e) {}
            alert('Lỗi: ' + errorMsg);
        }
        
        uploadBtn.disabled = false;
        loading.classList.add('hidden');
    };

    // Lỗi mạng hoặc server sập
    xhr.onerror = () => {
        alert('Mất kết nối đến máy chủ! Vui lòng kiểm tra lại mạng.');
        uploadBtn.disabled = false;
        loading.classList.add('hidden');
    };

    // Bắt đầu gửi đi
    xhr.send(formData);
});
