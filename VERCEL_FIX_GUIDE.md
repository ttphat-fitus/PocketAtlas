# Hướng dẫn Fix lỗi 404 trên Vercel

## Vấn đề hiện tại
- Trang chi tiết chuyến đi `/trip/[tripId]` trả về 404 trên production
- Build local thành công, tất cả routes đều có
- API routes đã được cấu hình đúng

## Nguyên nhân
1. **Vercel config sai cấu trúc monorepo**: Project có cấu trúc frontend/ và backend/ nhưng Vercel đang build từ root
2. **Output standalone gây conflict**: `next.config.ts` có `output: 'standalone'` gây vấn đề với Vercel deployment

## Giải pháp đã thực hiện

### 1. Cập nhật `vercel.json`
```json
{
  "buildCommand": "cd frontend && npm run build",
  "devCommand": "cd frontend && npm run dev",
  "installCommand": "cd frontend && npm install",
  "framework": "nextjs",
  "outputDirectory": "frontend/.next"
}
```

### 2. Cập nhật `frontend/next.config.ts`
Đã xóa dòng `output: 'standalone'` vì nó gây conflict với Vercel deployment.

### 3. Kiểm tra Routes
Build local cho thấy tất cả routes hoạt động:
- ✅ `/api/trip/[tripId]` - API route
- ✅ `/trip/[tripId]` - Page route  
- ✅ `/trip/explore/[tripId]` - Explore page route

## Các bước tiếp theo

### A. Push code và đợi deploy
```bash
git add -A
git commit -m "Fix: Update Vercel config for monorepo structure"
git push
```

Đợi 2-3 phút để Vercel build và deploy.

### B. Kiểm tra Vercel Dashboard Settings

1. Đăng nhập vào https://vercel.com
2. Vào project **pocketatlas**
3. Vào **Settings** → **General**
4. Kiểm tra các settings sau:

#### Root Directory
- Nên để **`frontend`** thay vì để trống
- Nếu đang để trống, đổi thành `frontend`
- Click **Save**

#### Build & Development Settings
Đảm bảo:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (hoặc để trống để auto-detect)
- **Output Directory**: `.next` (hoặc để trống)
- **Install Command**: `npm install` (hoặc để trống)

### C. Force Redeploy nếu cần

Nếu sau khi push mà vẫn lỗi:

1. Vào tab **Deployments**
2. Click vào deployment mới nhất
3. Click menu 3 chấm → **Redeploy**
4. Chọn **Use existing Build Cache** = OFF
5. Click **Redeploy**

### D. Clear Vercel Cache

Nếu vẫn còn lỗi:

1. Vào **Settings** → **Advanced**
2. Tìm section **Cache**
3. Click **Clear Cache**
4. Sau đó push 1 commit mới (có thể push empty commit):
```bash
git commit --allow-empty -m "Trigger rebuild"
git push
```

### E. Kiểm tra Environment Variables

Đảm bảo có biến môi trường:
- `NEXT_PUBLIC_BACKEND_URL` = `http://35.198.239.185:8000`

Vào **Settings** → **Environment Variables** để kiểm tra.

### F. Kiểm tra Build Logs

Sau khi deploy:
1. Vào tab **Deployments**
2. Click vào deployment mới nhất
3. Xem **Build Logs**
4. Tìm dòng:
   ```
   ├ ƒ /trip/[tripId]
   ├ ƒ /api/trip/[tripId]
   ```
   
Nếu thấy cả 2 routes này thì build thành công.

## Debug nếu vẫn lỗi

### 1. Test API Route trực tiếp
Mở browser console và test:
```javascript
fetch('https://pocketatlas.vercel.app/api/trip/YOUR_TRIP_ID', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
}).then(r => r.json()).then(console.log)
```

### 2. Kiểm tra Network Tab
- Mở DevTools → Network
- Load trang `/trip/[tripId]`
- Xem request nào bị lỗi
- Check response của API call

### 3. Kiểm tra có conflict routes không
Đảm bảo không có file:
- ❌ `frontend/app/api/trip/route.ts` (phải XÓA)
- ✅ `frontend/app/api/trip/[tripId]/route.ts` (phải GIỮ)

### 4. Test với trip ID khác
Có thể trip ID cụ thể bị lỗi, thử với trip khác:
- Vào `/trips` để xem danh sách
- Click vào trip khác
- Xem có lỗi không

## Checklist

- [ ] Push code mới lên Git
- [ ] Đợi Vercel build xong
- [ ] Kiểm tra Root Directory = `frontend` trong Vercel Settings
- [ ] Kiểm tra Build Logs có routes `/trip/[tripId]`
- [ ] Test trang `/trip/[tripId]` trên production
- [ ] Test trang `/trip/explore/[tripId]` trên production
- [ ] Nếu vẫn lỗi, clear cache và redeploy
- [ ] Nếu vẫn lỗi, kiểm tra Network tab xem request bị lỗi ở đâu

## Liên hệ nếu cần hỗ trợ

Nếu làm hết các bước trên mà vẫn lỗi, cung cấp:
1. Screenshot của Build Logs
2. Screenshot của Network tab (request bị lỗi)
3. URL cụ thể đang bị lỗi
4. Screenshot của Vercel Settings → General
