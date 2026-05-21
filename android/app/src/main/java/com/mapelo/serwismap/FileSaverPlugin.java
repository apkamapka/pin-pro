package com.mapelo.serwismap;

import android.Manifest;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saves a text file straight into the device's public Downloads folder.
 *
 * - Android 10+ (API 29+): MediaStore.Downloads, no runtime permission needed.
 * - Android 7–9 (API 24–28): legacy file write, needs WRITE_EXTERNAL_STORAGE.
 *
 * JS usage: FileSaver.saveToDownloads({ name, data, mimeType }) -> { uri }
 */
@CapacitorPlugin(
    name = "FileSaver",
    permissions = {
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }
        )
    }
)
public class FileSaverPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");

        if (name == null || data == null) {
            call.reject("name and data are required");
            return;
        }

        // Android 10+ uses MediaStore and requires no permission.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            performSave(call);
            return;
        }

        // Pre-Android 10 needs the storage permission.
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermsCallback");
        } else {
            performSave(call);
        }
    }

    @PermissionCallback
    private void storagePermsCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            performSave(call);
        } else {
            call.reject("Storage permission denied");
        }
    }

    private void performSave(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        byte[] bytes = data.getBytes(StandardCharsets.UTF_8);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                Uri item = getContext().getContentResolver().insert(collection, values);
                if (item == null) {
                    call.reject("Could not create file in Downloads");
                    return;
                }
                try (OutputStream os = getContext().getContentResolver().openOutputStream(item)) {
                    if (os == null) {
                        call.reject("Could not open output stream");
                        return;
                    }
                    os.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                getContext().getContentResolver().update(item, values, null, null);

                JSObject ret = new JSObject();
                ret.put("uri", item.toString());
                call.resolve(ret);
            } else {
                File downloads = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS);
                if (!downloads.exists()) downloads.mkdirs();
                File file = new File(downloads, name);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(bytes);
                }
                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[]{ file.getAbsolutePath() },
                    new String[]{ mimeType },
                    null
                );
                JSObject ret = new JSObject();
                ret.put("uri", Uri.fromFile(file).toString());
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Save failed: " + e.getMessage(), e);
        }
    }
}