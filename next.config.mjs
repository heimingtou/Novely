/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;

const nextConfig = {
  experimental: {
    // Ảnh đại diện tối đa 2MB / ảnh bìa 750KB gửi qua Server Action (mặc định giới hạn 1MB).
    serverActions: { bodySizeLimit: "3mb" },
  },
  images: {
    // Ảnh bìa trong dữ liệu seed dùng picsum.photos (chuyển hướng sang fastly.picsum.photos).
    // Ảnh tải lên Supabase Storage sau này nằm dưới /storage/v1/object/public/.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      ...(supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : []),
    ],
  },
};

export default nextConfig;
