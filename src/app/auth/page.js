'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import logoLight from '../../../public/logo.png';
import logoDark from '../../../public/darklogo.png';
import './auth.css';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
    rememberMe: false,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp!');
      return;
    }

    if (!isLogin && !formData.agreeTerms) {
      setError('Vui lòng đồng ý với điều khoản sử dụng của Novely!');
      return;
    }

    setLoading(true);

    try {
      // Giả lập kết nối API xác thực
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      if (isLogin) {
        router.push('/');
      } else {
        setIsLogin(true);
        setError('Đăng ký thành công! Vui lòng đăng nhập.');
      }
    } catch (err) {
      setError(err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Background Decor */}
      <div className="auth-backdrop-circle circle-1"></div>
      <div className="auth-backdrop-circle circle-2"></div>

      <div className="auth-card">
        {/* Header / Brand */}
        <div className="auth-header">
          <Link href="/" className="auth-brand">
            {/* 1. THAY EMOJI BẰNG LOGO CHUẨN CỦA DỰ ÁN */}
            <Image 
              src={logoLight} 
              alt="Novely Logo" 
              className="auth-logo block dark:hidden" 
              width={140} 
              height={40} 
              priority
            />
            <Image 
              src={logoDark} 
              alt="Novely Logo" 
              className="auth-logo hidden dark:block" 
              width={140} 
              height={40} 
              priority
            />
          </Link>
          <h1 className="auth-title">
            {isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
          </h1>
          <p className="auth-subtitle">
            {isLogin
              ? 'Đăng nhập để tiếp tục hành trình đọc và sáng tác tiểu thuyết.'
              : 'Gia nhập cộng đồng tác giả và độc giả tại Novely.'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
          >
            Đăng ký
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className={`auth-alert ${error.includes('thành công') ? 'success' : 'error'}`}>
            <span className="alert-icon">{error.includes('thành công') ? '✓' : '⚠️'}</span>
            <span className="alert-text">{error}</span>
          </div>
        )}

        {/* Form fields */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Tên đăng nhập / Bút danh (chỉ hiện khi Đăng ký) */}
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="username">Tên người dùng / Bút danh</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Nhập tên tài khoản hoặc bút danh"
                  value={formData.username}
                  onChange={handleChange}
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Địa chỉ Email</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Mật khẩu */}
          <div className="form-group">
            <div className="form-group-header">
              <label htmlFor="password">Mật khẩu</label>
              {isLogin && (
                <Link href="/auth/forgot-password" className="forgot-password-link">
                  Quên mật khẩu?
                </Link>
              )}
            </div>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="Tối thiểu 6 ký tự"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Nhập lại mật khẩu (Đăng ký) */}
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Nhập lại mật khẩu vừa đặt"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required={!isLogin}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex="-1"
                >
                  {showConfirmPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </div>
          )}

          {/* Tuỳ chọn ghi nhớ / điều khoản */}
          <div className="form-options">
            {isLogin ? (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>
            ) : (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  required
                />
                <span>
                  Tôi đồng ý với <Link href="/terms">Điều khoản</Link> & <Link href="/privacy">Bảo mật</Link>
                </span>
              </label>
            )}
          </div>

          {/* Nút hành động chính */}
          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : isLogin ? (
              'Đăng nhập'
            ) : (
              'Đăng ký tài khoản'
            )}
          </button>
        </form>

        {/* Đăng nhập bằng mạng xã hội */}
        <div className="auth-divider">
          <span>Hoặc tiếp tục với</span>
        </div>

        <div className="social-auth-grid">
          {/* Nút Google */}
          <button type="button" className="social-auth-btn">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.6 3.6 1.8 7.3l3.7 2.9C6.4 7.3 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
              />
              <path
                fill="#FBBC05"
                d="M5.5 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.8 6.3C.7 8.5 0 10.2 0 12s.7 3.5 1.8 5.7l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.6-2.3-6.5-5.2L1.8 16c1.8 3.7 5.6 7 10.2 7z"
              />
            </svg>
            <span>Google</span>
          </button>

          {/* 2. ĐÃ ĐỔI GITHUB THÀNH FACEBOOK */}
          <button type="button" className="social-auth-btn facebook-btn">
            <svg width="18" height="18" fill="#1877F2" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Facebook</span>
          </button>
        </div>

        {/* Footer switch prompt */}
        <div className="auth-footer">
          {isLogin ? (
            <p>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                }}
              >
                Đăng ký ngay
              </button>
            </p>
          ) : (
            <p>
              Đã có tài khoản?{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                }}
              >
                Đăng nhập
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
