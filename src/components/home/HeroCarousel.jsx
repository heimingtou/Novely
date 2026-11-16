"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./HeroCarousel.css";

const AUTOPLAY_DELAY = 5000;

export default function HeroCarousel({ slides, locale }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, AUTOPLAY_DELAY);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  const isEnglish = locale === "en";
  const slide = slides[activeIndex];
  const move = (offset) => {
    setActiveIndex((index) => (index + offset + slides.length) % slides.length);
  };

  return (
    <section className="home-hero" aria-roledescription="carousel" aria-label={isEnglish ? "Featured stories" : "Truyện nổi bật"}>
      <div className="home-hero__slides">
        {slides.map((item, index) => (
          <div
            className={`home-hero__slide${index === activeIndex ? " is-active" : ""}`}
            key={item.id}
            aria-hidden={index !== activeIndex}
          >
            <Image
              className="home-hero__image"
              src={item.image}
              alt={item.title}
              fill
              sizes="100vw"
              fetchPriority={index === 0 ? "high" : "auto"}
            />
          </div>
        ))}
      </div>

      <div className="home-hero__shade" />
      <div className="home-hero__content" key={slide.id}>
        <span className="home-hero__eyebrow">{isEnglish ? "FEATURED STORY" : "TRUYỆN ĐỀ CỬ"}</span>
        <h1 className="home-hero__title">{slide.title}</h1>
        <p className="home-hero__meta">{slide.genres} <span aria-hidden="true">·</span> {slide.likes} {isEnglish ? "reads" : "lượt yêu thích"}</p>
        <Link className="home-hero__link" href="/novels/demo">
          {isEnglish ? "Read story" : "Đọc truyện"}
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>

      {slides.length > 1 && (
        <>
          <button
            className="home-hero__arrow home-hero__arrow--previous"
            type="button"
            aria-label={isEnglish ? "Previous story" : "Truyện trước"}
            onClick={() => move(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            className="home-hero__arrow home-hero__arrow--next"
            type="button"
            aria-label={isEnglish ? "Next story" : "Truyện tiếp theo"}
            onClick={() => move(1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <div className="home-hero__pagination" aria-label={isEnglish ? "Choose a story" : "Chọn truyện"}>
            {slides.map((item, index) => (
              <button
                className={`home-hero__dot${index === activeIndex ? " is-active" : ""}`}
                key={item.id}
                type="button"
                aria-label={`${isEnglish ? "Story" : "Truyện"} ${index + 1}: ${item.title}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
