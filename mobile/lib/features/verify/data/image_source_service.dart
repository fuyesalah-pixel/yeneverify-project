// Gallery access behind a small interface so the controller stays testable
// (widget/unit tests override the provider with a fake and never touch a
// plugin channel).
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

abstract class VerifyImagePicker {
  /// Requests photo-library access. True when the app may read images.
  Future<bool> ensureGalleryAccess();

  /// Presents the system picker. Null when the user backs out.
  Future<File?> pickFromGallery();
}

class SystemImagePicker implements VerifyImagePicker {
  SystemImagePicker([ImagePicker? picker]) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<bool> ensureGalleryAccess() async {
    // Android 13+ maps this to READ_MEDIA_IMAGES, older versions to
    // READ_EXTERNAL_STORAGE. The modern system photo picker needs no
    // permission at all, so a denial must not hard-block the flow: the
    // picker itself still opens and the user can choose an image.
    final status = await Permission.photos.status;
    if (status.isGranted || status.isLimited) return true;

    final requested = await Permission.photos.request();
    if (requested.isGranted || requested.isLimited) return true;
    if (requested.isPermanentlyDenied || requested.isRestricted) {
      return _canPickWithoutPermission();
    }
    return true;
  }

  /// image_picker's Android photo picker works without the legacy
  /// permission, so only a hard "denied forever + no picker" case blocks.
  bool _canPickWithoutPermission() => true;

  @override
  Future<File?> pickFromGallery() async {
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      // Compress ourselves in ImagePrep so sha256 matches exactly what is
      // uploaded — never let the picker pre-process the bytes.
      imageQuality: 100,
      maxWidth: null,
      maxHeight: null,
      requestFullMetadata: false,
    );
    if (picked == null) return null;
    return File(picked.path);
  }
}

final verifyImagePickerProvider = Provider<VerifyImagePicker>(
  (ref) => SystemImagePicker(),
);
