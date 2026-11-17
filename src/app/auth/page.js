'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n/LocaleProvider';
import logoLight from '../../../public/logo.png';
import logoDark from '../../../public/darklogo.png';
import googleLogo from './Google__G__logo.svg';
import './auth.css';

export default function AuthPage() {
  const router = useRouter();
  const { t } = useI18n();
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
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
    setIsSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSuccess(false);

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError(t('Mật khẩu xác nhận không khớp!'));
      return;
    }

    if (!isLogin && !formData.agreeTerms) {
      setError(t('Vui lòng đồng ý với điều khoản sử dụng của Novely!'));
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
        setError(t('Đăng ký thành công! Vui lòng đăng nhập.'));
        setIsSuccess(true);
      }
    } catch (err) {
      setError(err?.message || t('Có lỗi xảy ra, vui lòng thử lại.'));
      setIsSuccess(false);
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
            {isLogin ? t('Chào mừng trở lại') : t('Tạo tài khoản mới')}
          </h1>
          <p className="auth-subtitle">
            {isLogin
              ? t('Đăng nhập để tiếp tục hành trình đọc và sáng tác tiểu thuyết.')
              : t('Gia nhập cộng đồng tác giả và độc giả tại Novely.')}
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
              setIsSuccess(false);
            }}
          >
            {t('Đăng nhập')}
          </button>
          <button
            type="button"
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false);
              setError('');
              setIsSuccess(false);
            }}
          >
            {t('Đăng ký')}
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className={`auth-alert ${isSuccess ? 'success' : 'error'}`}>
            <span className="alert-icon">{isSuccess ? '✓' : '⚠️'}</span>
            <span className="alert-text">{t(error)}</span>
          </div>
        )}

        {/* Form fields */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Tên đăng nhập / Bút danh (chỉ hiện khi Đăng ký) */}
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="username">{t('Tên người dùng / Bút danh')}</label>
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
                  placeholder={t('Nhập tên tài khoản hoặc bút danh')}
                  value={formData.username}
                  onChange={handleChange}
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">{t('Địa chỉ Email')}</label>
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
              <label htmlFor="password">{t('Mật khẩu')}</label>
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
                placeholder={t('Tối thiểu 6 ký tự')}
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
                aria-label={showPassword ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}
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
              <label htmlFor="confirmPassword">{t('Xác nhận mật khẩu')}</label>
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
                  placeholder={t('Nhập lại mật khẩu vừa đặt')}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required={!isLogin}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex="-1"
                  aria-label={showConfirmPassword ? t('Ẩn mật khẩu xác nhận') : t('Hiện mật khẩu xác nhận')}
                >
                  {showConfirmPassword ? (
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
          )}

          {/* Tuỳ chọn ghi nhớ / điều khoản */}
          <div className="form-options">
            {isLogin ? (
              <>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                  />
                  <span>{t('Ghi nhớ đăng nhập')}</span>
                </label>
                <Link href="/auth/forgot-password" className="forgot-password-link">
                  {t('Quên mật khẩu?')}
                </Link>
              </>
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
                  {t('Tôi đồng ý với')} <Link href="/terms">{t('Điều khoản')}</Link> & <Link href="/privacy">{t('Bảo mật')}</Link>
                </span>
              </label>
            )}
          </div>

          {/* Nút hành động chính */}
          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : isLogin ? (
              t('Đăng nhập')
            ) : (
              t('Đăng ký tài khoản')
            )}
          </button>
        </form>

        {/* Đăng nhập bằng Gmail */}
        <div className="auth-divider">
          <span>{t('Hoặc tiếp tục với')}</span>
        </div>

        <div className="social-auth-grid">
          <button type="button" className="social-auth-btn">
            <Image src={googleLogo} alt="" width={18} height={18} aria-hidden="true" />
            <span>{t('Gmail')}</span>
          </button>
        </div>

        {/* Footer switch prompt */}
        <div className="auth-footer">
          {isLogin ? (
            <p>
              {t('Chưa có tài khoản?')}{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                  setIsSuccess(false);
                }}
              >
                {t('Đăng ký ngay')}
              </button>
            </p>
          ) : (
            <p>
              {t('Đã có tài khoản?')}{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                  setIsSuccess(false);
                }}
              >
                {t('Đăng nhập')}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
