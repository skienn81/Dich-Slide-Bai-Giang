<main_task>

**LỆNH THỰC THI CHÍNH (CHẾ ĐỘ: DỊCH BÀI GIẢNG TIẾNG ANH - SLIDE CANVAS):**
Dựa trên vai trò và toàn bộ quy chuẩn trong **System Instructions (SI)**, hãy tiếp nhận tệp slide bài giảng PDF đầu vào và thực hiện:
1. **Dịch thuật trọn vẹn 100% nội dung giảng dạy** từ tiếng Anh sang tiếng Việt theo văn phong sư phạm đại học chuẩn xác, mạch lạc, dễ hiểu.
2. **Tái tạo bài giảng dưới dạng bộ Slide HTML/CSS tương tác (Slide Canvas)**, bảo toàn 1:1 bố cục trực quan của slide bài giảng gốc.

</main_task>

<strict_slide_rules>

**[A] CÁC NGUYÊN TẮC VÀNG VỀ BỐ CỤC SLIDE (SLIDE CANVAS LAYOUT):**
* **Mỗi trang là một Slide riêng biệt**: Bọc toàn bộ nội dung của từng trang trong thẻ `<div class="slide-canvas" id="slide-[X]">`.
* **Chiều Ngang & Chiều Dọc Giãn Thoải Mái (Đồng bộ phẳng phiu theo slide lớn nhất)**:
  * **Chiều ngang**: Cho phép giãn thoải mái theo nội dung (như bảng số liệu, khung code rộng, 2 cột song song). Hệ thống tự động đồng bộ bề ngang tất cả slide theo slide lớn nhất để khi cuộn dọc xuống xem trang, mọi slide đều phẳng phiu, liền mạch, hoàn toàn không bị gai góc lệch viền!
  * **Chiều dọc tự do kéo dài vô tận theo nội dung**: TUYỆT ĐỐI KHÔNG gò bó kích thước chiều dọc, không ép tỉ lệ 16:9 hay `min-height` cố định. Slide dài bao nhiêu nội dung thì tự nhiên giãn nở chiều dọc bấy nhiêu để hiển thị trọn vẹn, rộng rãi, thoáng mắt.
* **Hỗ trợ Slide Lập trình & Khung Code**:
  * Nếu bài giảng có đoạn mã nguồn (Python, C/C++, Java, SQL...), hãy đặt trong `<div class="code-block-container"><div class="code-header"><span class="code-lang">TÊN_NGÔN_NGỮ</span><span class="code-title">TÊN_FILE_HOẶC_MÔ_TẢ</span></div><pre class="slide-code"><code>...</code></pre></div>`. Code hiển thị với font monospace sắc nét, thụt lề chuẩn, nền tối sang trọng.
* **Quy tắc Chống Co Ép Ảnh (Anti-Squash)**:
  * Cột hình ảnh/đồ thị (`slide-col-visual`) **KHÔNG ĐƯỢC BỊ CO NHỎ** thành hình con tem (tối thiểu 300px - 340px).
  * Nếu slide có dung lượng vừa phải: Sử dụng 2 cột `<div class="slide-body slide-body-two-column">`.
  * **Bố cục Xếp Tầng (`slide-body-stacked`)**: Nếu slide có nội dung chữ và công thức dài/dày đặc (từ 3 bullet dài hoặc từ 2 công thức lớn trở lên), hãy dùng `<div class="slide-body slide-body-stacked">` để chữ và công thức dàn đều toàn bộ chiều rộng ở trên, còn hình ảnh/đồ thị được đặt ở dưới căn giữa (`max-width: 520px`), giúp cả hai phần đều to rõ và thoáng mắt!
* **Khối Công Thức Toán Độc Lập Bên Dưới Dòng Chữ**:
  * Công thức khối `\[ ... \]` BẮT BUỘC đặt trong thẻ `<div class="math-block">` ở một dòng riêng bên dưới câu chữ mô tả. Tuyệt đối không nhét chung một dòng ngang với chữ bullet khiến chữ bị bóp nghẹt.
* **Khóa chặt Chú thích hình ảnh**: Chú thích hình (`Hình 2.6 | ...` / `Figure 2.6 | ...`) BẮT BUỘC nằm trong thẻ `<figcaption>` ngay dưới thẻ `<img>` (hoặc `<svg>`) bên cột hình ảnh. TUYỆT ĐỐI không để caption rơi xuống dưới cột văn bản.
* **Bảo tồn Dải Footer Trường học**: Tái tạo dải màu chân slide (ví dụ màu xanh dương, xanh navy) kèm tên trường/viện nguyên bản tiếng Anh (`VNU University of Engineering and Technology`) và số trang ở góc phải.
* **Bảo tồn Ký hiệu Bullet**: Nếu slide gốc dùng ô vuông `❑`, `■`, mũi tên `▸`, hãy dùng đúng ký hiệu đó thay vì tự ý đổi thành chấm tròn `•`.

</strict_slide_rules>

<selective_academic_translation>

**[B] NGUYÊN TẮC DỊCH CHỌN LỌC (SELECTIVE TRANSLATION):**
* **KHÔNG TÓM TẮT**: Dịch đầy đủ 100% các ý giảng dạy, lý thuyết, giải thích, điều kiện ràng buộc toán học, không bỏ sót bất kỳ dòng chữ nào của bài giảng.
* **XỬ LÝ HÌNH VẼ & ĐỒ THỊ**:
  * Nếu có ảnh trích xuất đính kèm: Giữ nguyên vẹn ảnh gốc bằng thẻ `<img src="ID_ẢNH_ĐƯỢC_CẤP" alt="..." class="slide-img">`.
  * Nếu là đồ thị vector, hệ trục tọa độ hoặc sơ đồ không có ID ảnh: Tái tạo trực quan bằng vector inline `<svg viewBox="0 0 400 300" class="slide-svg">...</svg>` hoặc khối HTML/CSS. TUYỆT ĐỐI KHÔNG xuất ra thẻ `<img>` với ID giả mạo hoặc placeholder làm hỏng hiển thị.
* **Thuật ngữ then chốt**: Kèm từ tiếng Anh trong ngoặc đơn ở lần xuất hiện đầu tiên (ví dụ: *Hạt ở trạng thái liên kết (Bound particle)*).
* **Công thức Toán học (LaTeX MathJax) & Quy tắc Dạng Hệ (Piecewise)**:
  * **Hàm phân nhánh / Điều kiện vùng**: BẮT BUỘC dùng hệ phương trình `\begin{cases} ... \end{cases}`, ví dụ:
    `\[ V(x) = \begin{cases} \infty, & \text{đối với vùng I và III} \\ 0, & \text{đối với vùng II} \end{cases} \]`
    TUYỆT ĐỐI KHÔNG chia nhỏ thành các biểu thức rời rạc xen kẽ chữ trên cùng dòng bullet làm sinh thanh cuộn ngang!
  * Biểu thức nội dòng dùng `\( ... \)`.
  * Biểu thức khối độc lập dùng `\[ ... \]`.
  * Các từ nối toán học (`và`, `với`, `do đó`, `trong đó`) phải được đặt mạch lạc, thụt lề chuẩn xác.
  * BẮT BUỘC nhúng MathJax script trong `<head>`:
    `<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" id="MathJax-script" async></script>`

</selective_academic_translation>

<output_format>

**[C] ĐỊNH DẠNG ĐẦU RA:**
* Xuất ra một tài liệu HTML5 hoàn chỉnh, hợp lệ, tự chứa toàn bộ CSS trong thẻ `<style>` ở phần `<head>` (theo đúng mẫu CSS của System Instructions).
* Đảm bảo tính responsive và hỗ trợ in ấn từng slide (`@media print`).
* Bắt đầu trực tiếp bằng `<!DOCTYPE html>` và kết thúc bằng `</html>`. Không bọc trong codeblock markdown nếu không được yêu cầu.

</output_format>
