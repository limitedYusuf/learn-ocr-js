new Vue({
  el: '#app',
  data: {
    pdf: null,
    text: '',
    loading: false,
    error: '',
    box: { x: 50, y: 50, width: 200, height: 100 },
    dragging: false,
    resizing: false,
    resizeDirection: '',
    showBox: false
  },
  computed: {
    boxStyle() {
      return {
        left: this.box.x + 'px',
        top: this.box.y + 'px',
        width: this.box.width + 'px',
        height: this.box.height + 'px'
      };
    }
  },
  methods: {
    handleFileUpload(event) {
      const file = event.target.files[0];
      if (file && file.type === 'application/pdf') {
        this.text = '';
        this.error = '';
        this.showBox = false;
        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result;
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          loadingTask.promise.then(pdf => {
            this.pdf = pdf;
            this.renderPage(1);
            this.showBox = true;
          });
        };
        reader.readAsArrayBuffer(file);
      }
    },
    renderPage(pageNum) {
      this.pdf.getPage(pageNum).then(page => {
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.getElementById('pdf-canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        page.render({ canvasContext: context, viewport: viewport });
      });
    },
    initDrag(event) {
      this.dragging = true;
      document.addEventListener('mousemove', this.doDrag);
      document.addEventListener('mouseup', this.stopDrag);
    },
    doDrag(event) {
      if (this.dragging) {
        const canvas = document.getElementById('pdf-canvas');
        const rect = canvas.getBoundingClientRect();
        const leftOffset = 20;
        const rightOffset = -30;

        const newX = this.box.x + event.movementX;
        const newY = this.box.y + event.movementY;

        if (newX < leftOffset) {
          this.box.x = leftOffset;
        } else if (newX + this.box.width > rect.width - rightOffset) {
          this.box.x = rect.width - this.box.width - rightOffset;
        } else {
          this.box.x = newX;
        }

        if (newY < leftOffset) {
          this.box.y = leftOffset;
        } else if (newY + this.box.height > rect.height - leftOffset) {
          this.box.y = rect.height - this.box.height - leftOffset;
        } else {
          this.box.y = newY;
        }
      }
    },
    stopDrag() {
      this.dragging = false;
      document.removeEventListener('mousemove', this.doDrag);
      document.removeEventListener('mouseup', this.stopDrag);
    },
    initResize(event, direction) {
      this.resizing = true;
      this.resizeDirection = direction;
      document.addEventListener('mousemove', this.doResize);
      document.addEventListener('mouseup', this.stopResize);
    },
    doResize(event) {
      if (this.resizing) {
        const { movementX, movementY } = event;
        const canvas = document.getElementById('pdf-canvas');
        const rect = canvas.getBoundingClientRect();

        switch (this.resizeDirection) {
          case 'top-left':
            if (this.box.x + movementX >= 0 && this.box.y + movementY >= 0) {
              this.box.width -= movementX;
              this.box.height -= movementY;
              if (this.box.width >= 20) {
                this.box.x += movementX;
              }
              if (this.box.height >= 20) {
                this.box.y += movementY;
              }
            }
            break;
          case 'top-right':
            if (this.box.y + movementY >= 0 && this.box.x + this.box.width + movementX <= rect.width) {
              this.box.width += movementX;
              this.box.height -= movementY;
              if (this.box.height >= 20) {
                this.box.y += movementY;
              }
            }
            break;
          case 'bottom-left':
            if (this.box.x + movementX >= 0 && this.box.y + this.box.height + movementY <= rect.height) {
              this.box.width -= movementX;
              this.box.height += movementY;
              if (this.box.width >= 20) {
                this.box.x += movementX;
              }
            }
            break;
          case 'bottom-right':
            if (this.box.x + this.box.width + movementX <= rect.width && this.box.y + this.box.height + movementY <= rect.height) {
              this.box.width += movementX;
              this.box.height += movementY;
            }
            break;
        }

        if (this.box.width < 20) {
          this.box.width = 20;
        }
        if (this.box.height < 20) {
          this.box.height = 20;
        }

        if (this.box.x < 0) {
          this.box.x = 0;
        }
        if (this.box.y < 0) {
          this.box.y = 0;
        }
        if (this.box.x + this.box.width > rect.width) {
          this.box.width = rect.width - this.box.x;
        }
        if (this.box.y + this.box.height > rect.height) {
          this.box.height = rect.height - this.box.y;
        }
      }
    },
    stopResize() {
      this.resizing = false;
      document.removeEventListener('mousemove', this.doResize);
      document.removeEventListener('mouseup', this.stopResize);
    },
    processOCR() {
      this.loading = true;
      const canvas = document.getElementById('pdf-canvas');
      const context = canvas.getContext('2d');
      const { x, y, width, height } = this.box;

      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;

      const margin = 5;

      const pdfX = Math.max(0, Math.floor((x - margin) * scaleX));
      const pdfY = Math.max(0, Math.floor((y - margin) * scaleY));
      const pdfWidth = Math.min(canvas.width - pdfX, Math.ceil((width + 2 * margin) * scaleX));
      const pdfHeight = Math.min(canvas.height - pdfY, Math.ceil((height + 2 * margin) * scaleY));

      const imageData = context.getImageData(pdfX, pdfY, pdfWidth, pdfHeight);

      const newCanvas = document.createElement('canvas');
      newCanvas.width = pdfWidth;
      newCanvas.height = pdfHeight;
      newCanvas.getContext('2d').putImageData(imageData, 0, 0);

      Tesseract.recognize(newCanvas, 'ind', {
        logger: m => console.log(m)
      }).then(({ data: { text } }) => {
        this.text = text;
        this.loading = false;
      }).catch(err => {
        this.error = 'Terjadi kesalahan saat memproses file: ' + err.message;
        this.loading = false;
      });
    }

  }
});