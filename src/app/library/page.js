'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Clock, 
  Trash2, 
  Search, 
  Play, 
  ChevronRight, 
  Library as LibraryIcon,
  BookMarked
} from 'lucide-react';
import './lib.css';

// Dữ liệu truyện mẫu mặc định (dùng ảnh /CardStory.jpg có sẵn trong project)
const DEFAULT_READING_HISTORY = [
  {
    id: '1',
    title: 'Vạn Cổ Đệ Nhất Thần',
    author: 'Phong Thanh Dương',
    cover: '/CardStory.jpg',
    category: 'Tiên Hiệp',
    currentChapter: 15,
    totalChapters: 120,
    lastReadAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    progress: 13,
  },
  {
    id: '2',
    title: 'Đại Phụng Đả Canh Nhân',
    author: 'Mại Báo Tiểu Lang Quân',
    cover: '/CardStory.jpg',
    category: 'Huyền Huyễn',
    currentChapter: 42,
    totalChapters: 95,
    lastReadAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    progress: 44,
  },
  {
    id: '3',
    title: 'Toàn Trí Độc Giả',
    author: 'Sing Shong',
    cover: '/CardStory.jpg',
    category: 'Hành Động',
    currentChapter: 88,
    totalChapters: 150,
    lastReadAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    progress: 59,
  }
];

const DEFAULT_BOOKMARKS = [
  {
    id: '1',
    title: 'Vạn Cổ Đệ Nhất Thần',
    author: 'Phong Thanh Dương',
    cover: '/CardStory.jpg',
    category: 'Tiên Hiệp',
    latestChapter: 120,
    savedAt: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
  },
  {
    id: '2',
    title: 'Đại Phụng Đả Canh Nhân',
    author: 'Mại Báo Tiểu Lang Quân',
    cover: '/CardStory.jpg',
    category: 'Huyền Huyễn',
    latestChapter: 95,
    savedAt: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
  }
];

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'bookmarks'
  const [historyList, setHistoryList] = useState([]);
  const [bookmarkList, setBookmarkList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 1. Đồng bộ Theme sáng / tối trực tiếp từ switch ở thanh Navbar
  useEffect(() => {
    const syncTheme = () => {
      const isDarkClass = document.documentElement.classList.contains('dark');
      const isDarkAttr = document.documentElement.getAttribute('data-theme') === 'dark';
      const storedTheme = localStorage.getItem('theme');
      setIsDarkMode(isDarkClass || isDarkAttr || storedTheme === 'dark');
    };

    syncTheme();

    const observer = new MutationObserver(() => syncTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  // 2. Nạp dữ liệu: Nếu chưa có hoặc mảng rỗng thì luôn tự động tạo lại dữ liệu mẫu
  useEffect(() => {
    try {
      const rawHistory = localStorage.getItem('novely_reading_history');
      const parsedHistory = rawHistory ? JSON.parse(rawHistory) : null;
      if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
        setHistoryList(parsedHistory);
      } else {
        setHistoryList(DEFAULT_READING_HISTORY);
        localStorage.setItem('novely_reading_history', JSON.stringify(DEFAULT_READING_HISTORY));
      }

      const rawBookmarks = localStorage.getItem('novely_bookmarks');
      const parsedBookmarks = rawBookmarks ? JSON.parse(rawBookmarks) : null;
      if (Array.isArray(parsedBookmarks) && parsedBookmarks.length > 0) {
        setBookmarkList(parsedBookmarks);
      } else {
        setBookmarkList(DEFAULT_BOOKMARKS);
        localStorage.setItem('novely_bookmarks', JSON.stringify(DEFAULT_BOOKMARKS));
      }
    } catch (e) {
      console.error('Lỗi khi nạp dữ liệu thư viện:', e);
      setHistoryList(DEFAULT_READING_HISTORY);
      setBookmarkList(DEFAULT_BOOKMARKS);
    }
  }, []);

  // Xóa toàn bộ lịch sử đọc (nếu F5 tải lại trang sẽ tự phục hồi lại danh sách mẫu)
  const handleClearHistory = () => {
    if (confirm('Bạn có chắc muốn xóa lịch sử? (Tải lại trang F5 sẽ tự khôi phục dữ liệu mẫu)')) {
      setHistoryList([]);
      localStorage.removeItem('novely_reading_history');
    }
  };

  // Xóa từng truyện khỏi lịch sử
  const handleRemoveHistoryItem = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = historyList.filter(item => String(item.id) !== String(id));
    setHistoryList(updated);
    localStorage.setItem('novely_reading_history', JSON.stringify(updated));
  };

  // Xóa từng truyện khỏi tủ sách
  const handleRemoveBookmarkItem = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = bookmarkList.filter(item => String(item.id) !== String(id));
    setBookmarkList(updated);
    localStorage.setItem('novely_bookmarks', JSON.stringify(updated));
  };

  // Khôi phục nhanh dữ liệu mẫu bằng tay
  const handleRestoreDefault = () => {
    setHistoryList(DEFAULT_READING_HISTORY);
    setBookmarkList(DEFAULT_BOOKMARKS);
    localStorage.setItem('novely_reading_history', JSON.stringify(DEFAULT_READING_HISTORY));
    localStorage.setItem('novely_bookmarks', JSON.stringify(DEFAULT_BOOKMARKS));
  };

  const formatTimeAgo = (dateString) => {
    const diff = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
  };

  const filteredHistory = historyList.filter(item =>
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.author?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBookmarks = bookmarkList.filter(item =>
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.author?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`library-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <div className="library-content">
        {/* Header thư viện */}
        <div className="library-header">
          <div className="library-title-box">
            <div className="library-icon-badge">
              <LibraryIcon size={26} />
            </div>
            <div>
              <h1 className="library-title">Thư viện của bạn</h1>
              <p className="library-subtitle">Quản lý lịch sử đọc và những bộ tiểu thuyết bạn đã lưu</p>
            </div>
          </div>

          <div className="library-search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm truyện trong thư viện..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Thanh chuyển đổi Tab */}
        <div className="library-tabs-bar">
          <div className="library-tabs">
            <button
              className={`lib-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <Clock size={17} />
              <span>Đã đọc gần đây</span>
              <span className="tab-count">{historyList.length}</span>
            </button>

            <button
              className={`lib-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookmarks')}
            >
              <BookMarked size={17} />
              <span>Tủ sách đã lưu</span>
              <span className="tab-count">{bookmarkList.length}</span>
            </button>
          </div>

          {activeTab === 'history' && historyList.length > 0 && (
            <button className="clear-history-btn" onClick={handleClearHistory}>
              <Trash2 size={16} />
              <span>Xóa lịch sử</span>
            </button>
          )}
        </div>

        {/* Danh sách Đã đọc gần đây */}
        {activeTab === 'history' ? (
          filteredHistory.length > 0 ? (
            <div className="history-grid">
              {filteredHistory.map((novel) => (
                <div key={novel.id} className="history-card">
                  <div className="card-cover-wrapper">
                    <img 
                      src={novel.cover} 
                      alt={novel.title} 
                      className="card-cover" 
                      loading="lazy"
                    />
                  </div>

                  <div className="card-info">
                    <div className="card-top">
                      <span className="card-category">{novel.category}</span>
                      <button 
                        className="delete-item-btn" 
                        onClick={(e) => handleRemoveHistoryItem(novel.id, e)}
                        title="Xóa khỏi lịch sử"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <Link href={`/novel/${novel.id}`} className="card-title">
                      {novel.title}
                    </Link>

                    <p className="card-author">Tác giả: {novel.author}</p>

                    <div className="progress-section">
                      <div className="progress-labels">
                        <span>Đã đọc: Chương {novel.currentChapter}/{novel.totalChapters}</span>
                        <span>{novel.progress}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div 
                          className="progress-bar-fill" 
                          style={{ width: `${Math.max(novel.progress, 5)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="card-footer">
                      <span className="read-time">
                        <Clock size={13} /> {formatTimeAgo(novel.lastReadAt)}
                      </span>

                      <Link 
                        href={`/novel/${novel.id}`}
                        className="continue-btn"
                      >
                        <span>Đọc tiếp</span>
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>Chưa có lịch sử đọc truyện</h3>
              <p>Khám phá kho tàng tiểu thuyết phong phú của Novely hoặc tải lại dữ liệu mẫu!</p>
              <button onClick={handleRestoreDefault} className="explore-btn">
                Tạo lại dữ liệu mẫu
              </button>
            </div>
          )
        ) : (
          /* Danh sách Tủ sách đã lưu */
          filteredBookmarks.length > 0 ? (
            <div className="history-grid">
              {filteredBookmarks.map((novel) => (
                <div key={novel.id} className="history-card bookmark-card">
                  <div className="card-cover-wrapper">
                    <img 
                      src={novel.cover} 
                      alt={novel.title} 
                      className="card-cover" 
                      loading="lazy"
                    />
                  </div>

                  <div className="card-info">
                    <div className="card-top">
                      <span className="card-category">{novel.category}</span>
                      <button 
                        className="delete-item-btn" 
                        onClick={(e) => handleRemoveBookmarkItem(novel.id, e)}
                        title="Bỏ lưu truyện"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <Link href={`/novel/${novel.id}`} className="card-title">
                      {novel.title}
                    </Link>

                    <p className="card-author">Tác giả: {novel.author}</p>
                    <p className="latest-chap">Mới nhất: Chương {novel.latestChapter}</p>

                    <div className="card-footer bookmark-footer">
                      <Link 
                        href={`/novel/${novel.id}`}
                        className="continue-btn full-width"
                      >
                        <span>Xem chi tiết</span>
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>Tủ sách đang trống</h3>
              <p>Hãy lưu lại các bộ tiểu thuyết yêu thích hoặc khôi phục danh sách mẫu!</p>
              <button onClick={handleRestoreDefault} className="explore-btn">
                Tạo lại dữ liệu mẫu
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
