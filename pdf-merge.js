/* Browser-only: compress images + merge several image Files → one PDF. Load after jsPDF UMD. */
(function (global) {
  var MAX_SIDE = 1280;
  var JPEG_QUALITY = 0.72;
  var COMPRESS_IF_BYTES = 400 * 1024;

  function canvasToJpegBlob(canvas, quality) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('toBlob_fail'));
        }, 'image/jpeg', quality);
      } else {
        try {
          var dataUrl = canvas.toDataURL('image/jpeg', quality);
          var bin = atob(dataUrl.split(',')[1] || '');
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: 'image/jpeg' }));
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('read_error')); };
      r.readAsDataURL(blob);
    });
  }

  function releaseBitmap(bmp) {
    try { if (bmp && typeof bmp.close === 'function') bmp.close(); } catch (e) {}
  }

  async function decodeToBitmap(file, maxSide) {
    if (typeof createImageBitmap === 'function') {
      try {
        var bmp = await createImageBitmap(file);
        var w = bmp.width;
        var h = bmp.height;
        if (w < 1 || h < 1) { releaseBitmap(bmp); throw new Error('image_load_error'); }
        if (w > maxSide || h > maxSide) {
          var scale = Math.min(maxSide / w, maxSide / h);
          var nw = Math.max(1, Math.round(w * scale));
          var nh = Math.max(1, Math.round(h * scale));
          var resized = await createImageBitmap(bmp, { resizeWidth: nw, resizeHeight: nh, resizeQuality: 'medium' });
          releaseBitmap(bmp);
          return resized;
        }
        return bmp;
      } catch (e1) {
        /* fall through to Image path */
      }
    }
    var url = URL.createObjectURL(file);
    try {
      var img = await new Promise(function (resolve, reject) {
        var el = new Image();
        el.onload = function () { resolve(el); };
        el.onerror = function () { reject(new Error('image_load_error')); };
        el.src = url;
      });
      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      if (iw < 1 || ih < 1) throw new Error('image_load_error');
      var tw = iw;
      var th = ih;
      if (iw > maxSide || ih > maxSide) {
        var r = Math.min(maxSide / iw, maxSide / ih);
        tw = Math.max(1, Math.round(iw * r));
        th = Math.max(1, Math.round(ih * r));
      }
      var c = document.createElement('canvas');
      c.width = tw;
      c.height = th;
      var ctx = c.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, tw, th);
      ctx.drawImage(img, 0, 0, tw, th);
      img.src = '';
      if (typeof createImageBitmap === 'function') {
        try { return await createImageBitmap(c); } catch (e2) { /* use canvas as source via draw later */ }
      }
      return { width: tw, height: th, _canvas: c, close: function () { c.width = 0; c.height = 0; } };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function fileToScaledJpegBlob(file, maxSide, quality) {
    var bmp = await decodeToBitmap(file, maxSide);
    var w = bmp.width;
    var h = bmp.height;
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    if (bmp._canvas) ctx.drawImage(bmp._canvas, 0, 0);
    else ctx.drawImage(bmp, 0, 0);
    releaseBitmap(bmp);
    var blob = await canvasToJpegBlob(c, quality);
    c.width = 0;
    c.height = 0;
    return blob;
  }

  async function compressImageFileForUpload(file, opts) {
    opts = opts || {};
    var maxSide = opts.maxSide || MAX_SIDE;
    var quality = opts.quality != null ? opts.quality : JPEG_QUALITY;
    if (!file) throw new Error('no_file');
    var isImg = (file.type && file.type.startsWith('image/')) ||
      /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name || '');
    if (!isImg) return file;
    if (file.size > 0 && file.size <= COMPRESS_IF_BYTES &&
        (!file.type || file.type === 'image/jpeg' || file.type === 'image/jpg')) {
      return file;
    }
    var blob = await fileToScaledJpegBlob(file, maxSide, quality);
    var raw = (file.name || 'photo').replace(/\.[^.]+$/i, '');
    var base = raw.replace(/[\\/:"*?<>|]+/g, '_').trim().slice(0, 80) || 'photo';
    var out = new File([blob], base + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
    if (out.size > 0 && file.size > 0 && out.size >= file.size * 0.95 && file.size <= 2 * 1024 * 1024) {
      return file;
    }
    return out;
  }

  async function mergeImageFilesToPdf(imageFiles) {
    var jspdfMod = global.jspdf;
    if (!jspdfMod || !jspdfMod.jsPDF) throw new Error('pdf_lib_missing');
    var jsPDF = jspdfMod.jsPDF;
    var doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    var margin = 24;
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var maxW = pageW - 2 * margin;
    var maxH = pageH - 2 * margin;

    for (var i = 0; i < imageFiles.length; i++) {
      if (i > 0) doc.addPage();
      var jpegBlob = await fileToScaledJpegBlob(imageFiles[i], MAX_SIDE, JPEG_QUALITY);
      var jpegUrl = await blobToDataUrl(jpegBlob);
      jpegBlob = null;
      var dims = await new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onload = null;
          img.src = '';
        };
        img.onerror = function () { reject(new Error('image_load_error')); };
        img.src = jpegUrl;
      });
      var scale = Math.min(maxW / dims.w, maxH / dims.h, 1);
      var dw = dims.w * scale;
      var dh = dims.h * scale;
      var x = margin + (maxW - dw) / 2;
      var y = margin + (maxH - dh) / 2;
      doc.addImage(jpegUrl, 'JPEG', x, y, dw, dh);
      jpegUrl = null;
    }

    var buf = doc.output('arraybuffer');
    var blob = new Blob([buf], { type: 'application/pdf' });
    var raw = (imageFiles[0] && imageFiles[0].name ? imageFiles[0].name : 'images').replace(/\.[^.]+$/i, '');
    var base = raw.replace(/[\\/:"*?<>|]+/g, '_').trim().slice(0, 80) || 'images';
    return new File([blob], base + '_combined.pdf', { type: 'application/pdf' });
  }

  global.mergeImageFilesToPdf = mergeImageFilesToPdf;
  global.compressImageFileForUpload = compressImageFileForUpload;
})(typeof window !== 'undefined' ? window : globalThis);
