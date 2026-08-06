import React from "react";

export default function ContactAvatar({ src, alt, fallback, className = "" }) {
  const [falhou, setFalhou] = React.useState(false);

  React.useEffect(() => {
    setFalhou(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <span className="absolute inset-0 flex items-center justify-center">{fallback}</span>
      {src && !falhou && (
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFalhou(true)}
        />
      )}
    </div>
  );
}