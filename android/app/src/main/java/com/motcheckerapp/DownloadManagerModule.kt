package com.motcheckerapp

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DownloadManagerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DownloadManagerModule"

    @ReactMethod
    fun downloadFile(
        url: String,
        fileName: String,
        title: String,
        mimeType: String?,
        promise: Promise
    ) {
        try {
            val downloadManager =
                reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
            if (downloadManager == null) {
                promise.reject("E_NO_DOWNLOAD_MANAGER", "DownloadManager service is not available on this device")
                return
            }

            val uri = Uri.parse(url)
            val request = DownloadManager.Request(uri).apply {
                val displayTitle = if (title.isNotBlank()) title else fileName
                setTitle(displayTitle)
                setDescription("Downloading $fileName to device storage")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
                if (!mimeType.isNullOrBlank()) {
                    setMimeType(mimeType)
                }
            }

            val downloadId = downloadManager.enqueue(request)
            promise.resolve(downloadId.toString())
        } catch (e: Exception) {
            promise.reject("E_DOWNLOAD_FAILED", e.message ?: "Failed to start download", e)
        }
    }
}
