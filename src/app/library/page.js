'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  Bookmark, 
  Clock, 
  Trash2, 
  Search, 
  Play, 
  ChevronRight, 
  Library as LibraryIcon,
  BookMarked
} from 'lucide-react';

import { novels } from '@/data/novels.mjs';
import './lib.css';

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'bookmarks'
  const [historyList, setHistoryList] = useState([]);
  const [bookmarkList, setBookmarkList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Nạp dữ liệu từ localStorage, nếu chưa có thì lấy từ danh sách novels của dự án
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('novely_reading_history');
      if (storedHistory) {
        setHistoryList(JSON.parse(storedHistory));
      } else if (novels && novels.length > 0) {
        // Lấy 3 truyện đầu tiên trong file novels.mjs làm lịch sử đọc mặc định
        const initialHistory = novels.slice(0, 3).map((item, index) => ({
          id: String(item.id),
          title: item.title,
          author: item.author || 'Tác giả Novely',
          cover: item.coverImage || item.cover || '/CardStory.jpg',
          category: item.genre || item.category || 'Thịnh hành',
          currentChapter: index === 0 ? 12 : index === 1 ? 5 : 1,
          totalChapters: item.chapters?.length || 50,
          lastReadAt: new Date(Date.now() - (index + 1) * 3600 * 1000).toISOString(),
          progress: Math.round(((index === 0 ? 12 : index === 1 ? 5 : 1) / (item.chapters?.length || 50)) * 100),
        }));

        setHistoryList(initialHistory);
        localStorage.setItem('novely_reading_history', JSON.stringify(initialHistory));
      }

      const storedBookmarks = localStorage.getItem('novely_bookmarks');
      if (storedBookmarks) {
        setBookmarkList(JSON.parse(storedBookmarks));
      } else if (novels && novels.length > 0) {
        // Lấy truyện trong novels.mjs đưa vào tủ sách đã lưu
        const initialBookmarks = novels.slice(0, 2).map((item) => ({
          id: String(item.id),
          title: item.title,
          author: item.author || 'Tác giả Novely',
          cover: item.coverImage || item.cover || '/CardStory.jpg',
          category: item.genre || item.category || 'Thịnh hành',
          latestChapter: item.chapters?.length || 50,
          savedAt: new Date().toISOString(),
        }));

        setBookmarkList(initialBookmarks);
        localStorage.setItem('novely_bookmarks', JSON.stringify(initialBookmarks));
      }
    } catch (e) {
      console.error('Lỗi khi nạp dữ liệu truyện:', e);
    }
  }, []);

  const handleClearHistory = () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử đọc truyện không?')) {
      setHistoryList([]);
      localStorage.removeItem('novely_reading_history');
    }
  };

  const handleRemoveHistoryItem = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = historyList.filter(item => item.id !== id);
    setHistoryList(updated);
    localStorage.setItem('novely_reading_history', JSON.stringify(updated));
  };

  const handleRemoveBookmarkItem = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = bookmarkList.filter(item => item.id !== id);
    setBookmarkList(updated);
    localStorage.setItem('novely_bookmarks', JSON.stringify(updated));
  };

  const formatTimeAgo = (dateString) => {
    const diff = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
  };

  const filteredHistory = historyList.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBookmarks = bookmarkList.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="library-container">
      <div className="library-glow glow-1"></div>
      <div className="library-glow glow-2"></div>

      <div className="library-content">
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
                    <div className="cover-overlay">
                      <Link 
                        href={`/novels/${novel.id}/chapters/${novel.currentChapter || 1}`}
                        className="play-read-btn"
                        title="Đọc tiếp ngay"
                      >
                        <Play size={22} fill="currentColor" />
                      </Link>
                    </div>
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

                    <Link href={`/novels/${novel.id}`} className="card-title">
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
                        href={`/novels/${novel.id}/chapters/${novel.currentChapter || 1}`}
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
              <BookOpen size={64} className="empty-icon" />
              <h3>Chưa có lịch sử đọc truyện</h3>
              <p>Khám phá kho tàng tiểu thuyết phong phú của Novely và bắt đầu đọc ngay!</p>
              <Link href="/" className="explore-btn">
                Khám phá truyện ngay
              </Link>
            </div>
          )
        ) : (
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

                    <Link href={`/novels/${novel.id}`} className="card-title">
                      {novel.title}
                    </Link>

                    <p className="card-author">Tác giả: {novel.author}</p>
                    <p className="latest-chap">Mới nhất: Chương {novel.latestChapter}</p>

                    <div className="card-footer bookmark-footer">
                      <Link 
                        href={`/novels/${novel.id}`}
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
              <Bookmark size={64} className="empty-icon" />
              <h3>Tủ sách đang trống</h3>
              <p>Hãy lưu lại các bộ tiểu thuyết yêu thích để theo dõi chương mới thuận tiện hơn.</p>
              <Link href="/" className="explore-btn">
                Tìm truyện yêu thích
              </Link>
            </div>
          )
        )}
      </div>
    </div>
  );
}