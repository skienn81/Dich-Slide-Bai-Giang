<main_task>

**LỆNH THỰC THI CHÍNH:** 
Dựa trên vai trò và toàn bộ quy tắc đã được nạp trong **System Instructions (SI)**, hãy tiếp nhận tài liệu đầu vào và thực hiện:
1. Dịch thuật toàn bộ nội dung sang tiếng Việt.
2. Tái tạo tài liệu dưới dạng một tệp HTML/CSS hoàn chỉnh.

</main_task>

<strict_compliance_recall>

**[A] KÍCH HOẠT BỘ NHỚ HỆ THỐNG (TUÂN THỦ NGHIÊM NGẶT):**
Hãy gọi lại và áp dụng tuyệt đối **"Hệ thống Thứ tự Ưu tiên (1-4)"** và **"Quy tắc Giải quyết Xung đột"** trong SI:
* **[#1 & #1A]** Ý nghĩa chính xác 100% & Chuẩn hóa thuật ngữ học thuật.
* **[#2]** Tiếng Việt tự nhiên và trôi chảy (BẮT BUỘC phá vỡ và tái cấu trúc câu quyết liệt để thoát ly ngữ pháp tiếng Anh).
* **[#3]** HTML hiển thị hoàn hảo, không vỡ layout, font chữ nội dung chính đủ lớn để đọc.
* **[#4]** Bảo toàn định dạng gốc ở mức nỗ lực tối đa (Best-effort).

</strict_compliance_recall>

<technical_checklist>

**[B] CHECKLIST KỸ THUẬT QUAN TRỌNG:**
* **Cột & Layout:** Ép luồng văn bản chính về **1 CỘT DUY NHẤT**.
* **Bảng biểu:** BẮT BUỘC bọc mọi `<table>` bằng `<div class="table-wrapper">` (áp dụng CSS cơ sở trong SI) để chống tràn ngang.
* **Công thức Toán học:** Phải dùng cú pháp LaTeX `\(\)` và `\[\]`. BẮT BUỘC nhúng thẻ `<script>` MathJax vào `<head>`. (Giữ nguyên dấu chấm `.` thập phân bên trong block LaTeX).
* **TUYỆT ĐỐI KHÔNG** bọc các cú pháp LaTeX (cả `\( \)` và `\[ \]`) bên trong các thẻ HTML như `<code>` hay `<pre>`.
* **Tài liệu tham khảo (References):** KHÔNG DỊCH các thành phần nhận diện (Tác giả, Tên sách/báo, Tạp chí, DOI, URL...). Giữ nguyên định dạng gốc.
* **Hình ảnh:** Thẻ `<img>` phải có `alt` text tiếng Việt có ý nghĩa.
* **Xử lý "câu gãy" do PDF (Line breaks):** Tự động nhận diện và ghép nối (merge) các câu bị ngắt dòng vật lý do giới hạn trang PDF thành một câu hoàn chỉnh trong thẻ `<p>`.
* **Header/Footer PDF:** Tự động nhận diện và loại bỏ/gom nhóm các Header/Footer bị chèn ngang làm đứt gãy đoạn văn gốc, đảm bảo tính liên tục của đoạn văn bản.
* **Tối ưu thiết kế cho màn hình lớn**: Bản dịch cuối cùng có khả năng đọc được trên nhiều kích cỡ màn hình khác nhau, nhưng kích cỡ màn hình lớn (trên laptop/desktop) vẫn là ưu tiên cao nhất.

</technical_checklist>

<internal_quality_assurance>

**[C] BƯỚC TỰ ĐỐI SOÁT VÀ TINH CHỈNH (Internal QA - Thực hiện ngầm):**
Trước khi xuất kết quả cuối cùng, tự kiểm tra nội bộ:
1. *Văn phong đã đủ tự nhiên, trôi chảy chưa hay vẫn còn "mùi" dịch máy (word-by-word)?* -> Tự động sửa lại câu từ nếu thấy gượng gạo.
2. *Mã HTML có rủi ro tràn lề (overflow) hay cấu trúc thẻ sai logic không?* -> Tự động tối ưu lại CSS/HTML.

</internal_quality_assurance>

<image_handling>

**[D] XỬ LÝ HÌNH ẢNH & SƠ ĐỒ MẠCH / ĐỒ THỊ TỪ PDF:**
* **ƯU TIÊN SỐ 1 - SỬ DỤNG ẢNH CẮT GỐC NGUYÊN BẢN:** Nếu tài liệu PDF gốc có chứa hình ảnh hoặc sơ đồ mạch điện được trích xuất (ID có dạng `..._img_...` hoặc `..._fig_...`), **BẮT BUỘC chèn lại chính xác các hình ảnh này vào bản dịch HTML** bằng thẻ:
  `<figure class="diagram-figure" style="text-align: center; margin: 2rem auto;"><img src="[ID_CỦA_ẢNH]" alt="..." class="book-img" style="max-width: 100%; height: auto; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: pointer;"><figcaption style="margin-top: 10px; font-size: 0.95rem;"><strong>Hình X.X | [Tên hình]</strong><div class="diagram-notes" style="text-align: left; background: #f8fafc; padding: 10px 14px; border-radius: 6px; margin-top: 8px; font-size: 0.9rem; border-left: 3px solid #0284c7;"><!-- Dịch toàn bộ các nhãn, thông số, chiều dòng điện, bước giải trong hình ra đây để người học đối chiếu dễ dàng --></div></figcaption></figure>`.
* **BẢO TOÀN ĐỘ CHÍNH XÁC & KHÔNG VẼ LẠI:** Giữ nguyên vẹn ảnh gốc giúp người học có được độ chuẩn xác 100% tuyệt đối của giáo trình quốc tế, không lo sai lệch linh kiện hay giá trị điện trở, đồng thời hỗ trợ click phóng to (Lightbox). **TUYỆT ĐỐI KHÔNG CẦN TỰ VẼ LẠI MẠCH PHỨC TẠP BẰNG SVG NẾU ĐÃ CÓ ẢNH ĐƯỢC CẤP**.
* Chỉ khi nào KHÔNG có ID ảnh nào được cung cấp trong danh sách ảnh đính kèm thì mới áp dụng vẽ vector SVG đơn giản hoặc ghi chú sơ đồ.

</image_handling>

<output_constraints>

**[F] ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (STRICT OUTPUT BOUNDARY):**
* Chỉ trả về MÃ HTML THÔ.
* Bắt đầu chính xác bằng `<!DOCTYPE html>` và kết thúc bằng `</html>`.

</output_constraints>