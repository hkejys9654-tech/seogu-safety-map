(function (global) {
  "use strict";

  // 함께가게 현장 사진: 휴대폰 사진을 줄여서(긴 변 1280px, JPEG) 저장소에 바로 올립니다.
  const MAX_PHOTOS = 5;
  const MAX_DATA_LENGTH = 900000;

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ image, url });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("사진을 읽지 못했어요."));
      };
      image.src = url;
    });
  }

  async function shrink(file) {
    const { image, url } = await loadImage(file);
    try {
      let longSide = 1280;
      let quality = 0.78;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const scale = Math.min(1, longSide / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const data = canvas.toDataURL("image/jpeg", quality);
        if (data.length < MAX_DATA_LENGTH) return { data, width, height };
        longSide = Math.round(longSide * 0.8);
        quality = Math.max(0.5, quality - 0.08);
      }
      throw new Error("사진이 너무 커요.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = String(dataUrl).split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  global.HamkkePhotos = { MAX_PHOTOS, shrink, dataUrlToBytes };
})(window);
