import React from 'react';
import SafeAvatar from '../ui/SafeAvatar.jsx';
import ProfileAccessLayer from '../profile/ProfileAccessLayer.jsx';

export function ReviewStars({ value }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="tp-review-stars" aria-hidden>
      {'★'.repeat(v)}
      <span className="text-muted opacity-50">{'☆'.repeat(5 - v)}</span>
    </span>
  );
}

/**
 * Single review row with avatar, stars, reviewer name, date, and optional comment.
 */
const ReviewCard = ({ review, accent = false, className = '' }) => {
  const name = review?.fromName || review?.reviewerName || 'User';
  const avatar = review?.fromAvatar || review?.reviewerAvatarUrl || null;
  const rating = review?.rating ?? review?.score ?? 0;
  const accentClass = accent ? ' border-start border-warning border-3' : '';

  return (
    <li
      className={`tp-review-card rounded-4 p-3 border shadow-sm${accentClass}${className ? ` ${className}` : ''}`}
    >
      <div className="d-flex gap-3 align-items-start">
        {review?.fromUserId ? null : (
          <div className="tp-avatar-sm rounded-circle overflow-hidden border flex-shrink-0">
            <SafeAvatar src={avatar} name={name} />
          </div>
        )}
        <div className="flex-grow-1 min-w-0">
          <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-1">
            <div>
              {review?.fromUserId ? (
                <ProfileAccessLayer
                  userId={review.fromUserId}
                  name={name}
                  avatarSrc={avatar}
                  className="small mb-1"
                />
              ) : (
                <div className="fw-semibold small mb-1">{name}</div>
              )}
              <ReviewStars value={rating} />
            </div>
            {review?.createdAt ? (
              <time className="small text-muted text-nowrap" dateTime={review.createdAt}>
                {new Date(review.createdAt).toLocaleString()}
              </time>
            ) : null}
          </div>
          {review?.comment ? <p className="small mb-0 text-body">{review.comment}</p> : null}
        </div>
      </div>
    </li>
  );
};

export default ReviewCard;
