// On-device OCR with Google ML Kit.
//
// Runs after image prep and before upload, so the backend can skip its
// own OCR provider (14–48 s with Tesseract) when the on-device text is
// good enough. The text is a HINT: the backend still runs bank
// detection, reference extraction and the adapter lookup.
//
// ML Kit exposes no confidence score, so [classifyOnDeviceText]
// assigns a conservative heuristic band. The backend only prefers
// client OCR above 0.6.
import 'dart:io';
import 'dart:typed_data';

import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

import 'qr_detector.dart';

class OnDeviceOcrResult {
  const OnDeviceOcrResult({required this.text, required this.confidence});

  final String text;
  final double confidence;
}

/// Confidence bands. Below 0.6 the backend ignores the client text
/// and runs its own OCR, so a weak read never degrades the verdict.
const double _shortTextConfidence = 0.5;
const double _longTextConfidence = 0.7;
const double _referenceTextConfidence = 0.9;

const int _meaningfulTextLength = 40;

/// Classifies recognized text into a result + confidence band.
/// Pure function so it is unit-testable without the ML Kit plugin.
OnDeviceOcrResult? classifyOnDeviceText(String raw) {
  final text = raw.trim();
  if (text.isEmpty) return null;

  final confidence = containsReference(text)
      ? _referenceTextConfidence
      : text.length >= _meaningfulTextLength
          ? _longTextConfidence
          : _shortTextConfidence;

  return OnDeviceOcrResult(text: text, confidence: confidence);
}

/// On-device recognizer. Implementations must never throw — a missing
/// plugin, model, or permission simply means "no client OCR".
abstract class OnDeviceOcr {
  Future<OnDeviceOcrResult?> recognize(Uint8List imageBytes);
}

class MlKitOnDeviceOcr implements OnDeviceOcr {
  const MlKitOnDeviceOcr();

  @override
  Future<OnDeviceOcrResult?> recognize(Uint8List imageBytes) async {
    Directory? dir;
    TextRecognizer? recognizer;
    try {
      // ML Kit reads from a file path; the prepared (compressed) JPEG
      // is written to a private temp dir and removed afterwards.
      dir = await Directory.systemTemp.createTemp('yene_ocr_');
      final file = File('${dir.path}/receipt.jpg');
      await file.writeAsBytes(imageBytes, flush: true);

      recognizer = TextRecognizer();
      final recognized = await recognizer.processImage(
        InputImage.fromFilePath(file.path),
      );
      return classifyOnDeviceText(recognized.text);
    } catch (_) {
      return null;
    } finally {
      try {
        await recognizer?.close();
      } catch (_) {
        // Plugin already gone; nothing to release.
      }
      try {
        await dir?.delete(recursive: true);
      } catch (_) {
        // Temp cleanup is best-effort.
      }
    }
  }
}
