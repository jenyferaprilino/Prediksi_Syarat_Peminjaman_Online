
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field


# 1. Membuat aplikasi FastAPI
app = FastAPI(
    title="Loan Prediction API",
    description="API prediksi persetujuan pinjaman",
    version="1.0.0"
)


# 1b. Menyajikan file statis (HTML, CSS, JS)
app.mount("/static", StaticFiles(directory=Path(__file__).resolve().parent / "static"), name="static")


# 2. Mengambil lokasi model
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model" / "model_kelompok_1.joblib"


# 3. Memuat model Machine Learning
model = joblib.load(MODEL_PATH)


# 4. Membuat validasi input menggunakan Pydantic
class LoanInput(BaseModel):
    Gender: Literal["Male", "Female"]
    Married: Literal["Yes", "No"]
    Dependents: Literal["0", "1", "2", "3+"]
    Education: Literal["Graduate", "Not Graduate"]
    Self_Employed: Literal["Yes", "No"]

    ApplicantIncome: int = Field(ge=0)
    CoapplicantIncome: float = Field(ge=0)
    LoanAmount: float = Field(gt=0)
    Loan_Amount_Term: float = Field(gt=0)
    Credit_History: Literal[0, 1]

    Property_Area: Literal["Urban", "Rural", "Semiurban"]


# 5. Endpoint halaman utama – mengembalikan index.html
@app.get("/", response_class=HTMLResponse)
def home():
    index_path = Path(__file__).resolve().parent / "static" / "index.html"
    return HTMLResponse(content=index_path.read_text(encoding="utf-8"))


# 6. Endpoint pemeriksaan server
@app.get("/health")
def health():
    return {"status": "ok"}


# 7. Endpoint untuk melakukan prediksi
@app.post("/predict")
def predict(data: LoanInput):
    try:
        # Mengubah JSON menjadi DataFrame
        input_df = pd.DataFrame([data.model_dump()])

        # Melakukan prediksi
        prediction = str(model.predict(input_df)[0])

        # Menentukan hasil prediksi
        # Asumsi encoding target: Y = 1, N = 0
        if prediction in ("Y", "1"):
            status = "Pinjaman Disetujui"
        elif prediction in ("N", "0"):
            status = "Pinjaman Tidak Disetujui"
        else:
            status = "Hasil prediksi tidak dikenali"

        # Menyusun respons API
        response = {
            "prediction": prediction,
            "status": status
        }

        # Menampilkan probabilitas jika didukung model
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(input_df)[0]

            response["probabilities"] = {
                str(label): float(prob)
                for label, prob in zip(
                    model.classes_,
                    probabilities
                )
            }

        return response

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Prediksi gagal. Periksa kompatibilitas model."
        ) from exc
