import json
import os
import subprocess
import tempfile
from pathlib import Path


_WINRT_OCR_SCRIPT = r"""
param([string]$ImagePath)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

[Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null

$fullPath = (Resolve-Path $ImagePath).Path
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($fullPath)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

$items = @()
foreach ($line in $result.Lines) {
    $minX = [int]::MaxValue
    $minY = [int]::MaxValue
    $maxX = 0
    $maxY = 0
    foreach ($word in $line.Words) {
        $r = $word.BoundingRect
        if ([int]$r.X -lt $minX) { $minX = [int]$r.X }
        if ([int]$r.Y -lt $minY) { $minY = [int]$r.Y }
        if ([int]($r.X + $r.Width) -gt $maxX) { $maxX = [int]($r.X + $r.Width) }
        if ([int]($r.Y + $r.Height) -gt $maxY) { $maxY = [int]($r.Y + $r.Height) }
    }
    if ($minX -eq [int]::MaxValue) { $minX = 0; $minY = 0 }
    $items += [PSCustomObject]@{
        text = $line.Text
        confidence = 0.95
        box = @($minX, $minY, $maxX, $maxY)
    }
}
ConvertTo-Json -InputObject @($items) -Depth 4 -Compress
"""


class CertificateOCR:
    """
    OCR engine for extracting text from certificates using PaddleOCR,
    RapidOCR (ONNX PP-OCR), or Windows native WinRT OCR fallback.
    """

    def __init__(self):
        self._win_script_path = None

        try:
            from paddleocr import PaddleOCR

            print("Initializing PaddleOCR...")
            self.backend = "paddleocr"
            self.ocr = PaddleOCR(
                lang="en",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
            print("PaddleOCR initialized successfully.")
            return
        except ImportError:
            pass

        try:
            from rapidocr_onnxruntime import RapidOCR

            print("Initializing RapidOCR (ONNX PP-OCR)...")
            self.backend = "rapidocr"
            self.ocr = RapidOCR()
            print("RapidOCR initialized successfully.")
            return
        except ImportError:
            pass

        if os.name == "nt":
            print("Initializing Windows Native WinRT OcrEngine...")
            self.backend = "winrt"
            with tempfile.NamedTemporaryFile(delete=False, suffix=".ps1", mode="w", encoding="utf-8") as f:
                f.write(_WINRT_OCR_SCRIPT)
                self._win_script_path = f.name
            print("Windows Native WinRT OcrEngine initialized successfully.")
            return

        raise RuntimeError("No OCR backend installed (install paddleocr or rapidocr-onnxruntime).")

    def extract_text(self, image_path: str):
        """
        Extract text, confidence and bounding boxes from an image.

        Returns:
            list[dict]: OCR detections
        """
        extracted = []

        if self.backend == "paddleocr":
            results = self.ocr.predict(image_path)

            for result in results:
                data = result.json
                if isinstance(data, str):
                    data = json.loads(data)
                data = data.get("res", data)

                texts = data.get("rec_texts", [])
                scores = data.get("rec_scores", [])
                boxes = data.get("rec_boxes", [])

                for text, score, box in zip(texts, scores, boxes):
                    extracted.append({
                        "text": text,
                        "confidence": float(score),
                        "box": box.tolist() if hasattr(box, "tolist") else box,
                    })

            return extracted

        if self.backend == "rapidocr":
            results, _ = self.ocr(image_path)
            if not results:
                return extracted

            for item in results:
                raw_box, text, score = item[0], item[1], item[2]
                if isinstance(raw_box, (list, tuple)) and len(raw_box) == 4 and isinstance(raw_box[0], (list, tuple)):
                    xs = [int(pt[0]) for pt in raw_box]
                    ys = [int(pt[1]) for pt in raw_box]
                    box = [min(xs), min(ys), max(xs), max(ys)]
                else:
                    box = raw_box

                extracted.append({
                    "text": str(text),
                    "confidence": float(score),
                    "box": box,
                })

            return extracted

        # Windows WinRT native OCR
        abs_path = str(Path(image_path).resolve())
        proc = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                self._win_script_path,
                "-ImagePath",
                abs_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        raw = proc.stdout.strip()
        if not raw:
            return []
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            parsed = [parsed]
        return parsed
