/**
 * app.js – LoanAI Frontend
 * Mengintegrasikan form HTML dengan endpoint POST /predict
 * dan menampilkan hasil prediksi + probabilitas secara responsif.
 */

'use strict';

/* ------------------------------------------------------------------ */
/*  Referensi Elemen DOM                                                */
/* ------------------------------------------------------------------ */
const form          = document.getElementById('loan-form');
const submitBtn     = document.getElementById('submit-btn');
const resultSection = document.getElementById('result-section');
const resultCard    = document.getElementById('result-card');
const resultIcon    = document.getElementById('result-icon');
const resultStatus  = document.getElementById('result-status');
const resultRaw     = document.getElementById('result-raw');
const probSection   = document.getElementById('prob-section');
const probBars      = document.getElementById('prob-bars');
const resetBtn      = document.getElementById('reset-btn');

const errorSection  = document.getElementById('error-section');
const errorMessage  = document.getElementById('error-message');
const errorResetBtn = document.getElementById('error-reset-btn');

/* ------------------------------------------------------------------ */
/*  Konfigurasi kelas prediksi → tampilan ikon Bootstrap Icons         */
/* ------------------------------------------------------------------ */
const CLASS_CONFIG = {
  'Y': {
    label:    'Pinjaman Disetujui',
    css:      'approved',
    iconHTML: '<i class="bi bi-check-circle-fill"></i>',
    barLabel: 'Disetujui',
  },
  '1': {
    label:    'Pinjaman Disetujui',
    css:      'approved',
    iconHTML: '<i class="bi bi-check-circle-fill"></i>',
    barLabel: 'Disetujui',
  },
  'N': {
    label:    'Pinjaman Tidak Disetujui',
    css:      'rejected',
    iconHTML: '<i class="bi bi-x-circle-fill"></i>',
    barLabel: 'Tidak Disetujui',
  },
  '0': {
    label:    'Pinjaman Tidak Disetujui',
    css:      'rejected',
    iconHTML: '<i class="bi bi-x-circle-fill"></i>',
    barLabel: 'Tidak Disetujui',
  },
};

/* ------------------------------------------------------------------ */
/*  Submit Handler                                                      */
/* ------------------------------------------------------------------ */
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  hideSection(resultSection);
  hideSection(errorSection);
  setLoading(true);

  try {
    const payload = buildPayload(form);
    const result  = await sendPrediction(payload);
    renderResult(result);
  } catch (err) {
    renderError(err.message || 'Tidak dapat terhubung ke server. Pastikan API berjalan.');
  } finally {
    setLoading(false);
  }
});

/* ------------------------------------------------------------------ */
/*  Tombol Reset                                                        */
/* ------------------------------------------------------------------ */
resetBtn.addEventListener('click', resetPage);
errorResetBtn.addEventListener('click', resetPage);

function resetPage() {
  hideSection(resultSection);
  hideSection(errorSection);
  form.reset();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ */
/*  Membangun Payload dari FormData                                     */
/* ------------------------------------------------------------------ */
/**
 * Mengambil semua nilai form dan mengonversi tipe data
 * sesuai skema LoanInput di app.py.
 *
 * @param {HTMLFormElement} formEl
 * @returns {Object} payload JSON
 */
function buildPayload(formEl) {
  const fd = new FormData(formEl);

  return {
    Gender:            fd.get('Gender'),
    Married:           fd.get('Married'),
    Dependents:        fd.get('Dependents'),
    Education:         fd.get('Education'),
    Self_Employed:     fd.get('Self_Employed'),
    ApplicantIncome:   parseInt(fd.get('ApplicantIncome'),  10),
    CoapplicantIncome: parseFloat(fd.get('CoapplicantIncome')),
    LoanAmount:        parseFloat(fd.get('LoanAmount')),
    Loan_Amount_Term:  parseFloat(fd.get('Loan_Amount_Term')),
    Credit_History:    parseInt(fd.get('Credit_History'),   10),
    Property_Area:     fd.get('Property_Area'),
  };
}

/* ------------------------------------------------------------------ */
/*  Mengirim Permintaan POST ke /predict                               */
/* ------------------------------------------------------------------ */
/**
 * Mengirim payload ke endpoint FastAPI dan mengembalikan respons JSON.
 *
 * @param {Object} payload
 * @returns {Promise<Object>} data prediksi
 */
async function sendPrediction(payload) {
  const response = await fetch('/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = `Kesalahan server: ${response.status}`;
    try {
      const errBody = await response.json();
      detail = errBody.detail || detail;
    } catch (_) { /* abaikan error parsing */ }
    throw new Error(detail);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  Menampilkan Hasil Prediksi                                          */
/* ------------------------------------------------------------------ */
/**
 * Merender kartu hasil prediksi beserta bar probabilitas.
 *
 * @param {{ prediction: string, status: string, probabilities?: Object }} data
 */
function renderResult(data) {
  const { prediction, status, probabilities } = data;

  const config = CLASS_CONFIG[prediction] ?? {
    label:    status,
    css:      'neutral',
    iconHTML: '<i class="bi bi-cpu-fill"></i>',
    barLabel: prediction,
  };

  // Ikon hasil
  resultIcon.innerHTML  = config.iconHTML;
  resultIcon.className  = `result-icon-wrap ${config.css}`;

  // Teks status
  resultStatus.textContent = status || config.label;

  // Kode mentah
  resultRaw.textContent = prediction;

  // Warna kartu
  resultCard.className = `glass-card result-card ${config.css}`;

  // Probabilitas
  if (probabilities && Object.keys(probabilities).length > 0) {
    renderProbBars(probabilities);
    showSection(probSection);
  } else {
    hideSection(probSection);
  }

  showSection(resultSection);
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ */
/*  Merender Bar Probabilitas                                           */
/* ------------------------------------------------------------------ */
/**
 * Membuat elemen bar probabilitas untuk setiap kelas.
 *
 * @param {Object} probabilities – e.g. { "N": 0.12, "Y": 0.88 }
 */
function renderProbBars(probabilities) {
  probBars.innerHTML = '';

  // Urutan: approved terlebih dahulu (Y/1), lalu rejected (N/0)
  const sortOrder = ['Y', '1', 'N', '0'];
  const sorted = Object.entries(probabilities).sort(
    ([a], [b]) => sortOrder.indexOf(a) - sortOrder.indexOf(b)
  );

  sorted.forEach(([cls, prob]) => {
    const pct    = (prob * 100).toFixed(1);
    const config = CLASS_CONFIG[cls] ?? { barLabel: cls, css: 'neutral', iconHTML: '<i class="bi bi-circle-fill"></i>' };

    const item = document.createElement('div');
    item.className = 'prob-item';
    item.innerHTML = `
      <div class="prob-item-header">
        <span class="d-flex align-items-center gap-2">
          ${config.iconHTML}
          <span>${config.barLabel}</span>
        </span>
        <strong>${pct}%</strong>
      </div>
      <div class="prob-track">
        <div class="prob-fill ${config.css}" data-width="${pct}%" style="width:0"></div>
      </div>
    `;
    probBars.appendChild(item);
  });

  // Animasikan bar setelah render
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      probBars.querySelectorAll('.prob-fill').forEach((fill) => {
        fill.style.width = fill.dataset.width;
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Menampilkan Pesan Error                                             */
/* ------------------------------------------------------------------ */
/**
 * Merender kartu error dengan pesan yang diberikan.
 *
 * @param {string} message
 */
function renderError(message) {
  errorMessage.textContent = message;
  showSection(errorSection);
  errorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ */
/*  Helpers: Loading State, Show/Hide                                   */
/* ------------------------------------------------------------------ */
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle('loading', isLoading);
}

function showSection(el) { el.hidden = false; }
function hideSection(el) { el.hidden = true;  }
