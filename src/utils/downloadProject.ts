/**
 * Robust Client-Side Project Source Downloader
 * Fetches entire zip archive into an in-memory Blob before saving,
 * preventing iframe connection drops, truncated chunks, and Windows zip corruption.
 */
export async function downloadProjectSourceZip(): Promise<boolean> {
  try {
    // Fetch directly from API endpoint which streams validated application/zip
    const timestamp = Date.now();
    const res = await fetch(`/api/project-zip?t=${timestamp}`);

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (blob.size < 500) {
      throw new Error(`Fayl hajmi noto'g'ri (${blob.size} bytes)`);
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = blobUrl;
    link.download = 'Grand_Turan_AI_Full_Project_Source.zip';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 2000);

    return true;
  } catch (error) {
    console.warn('Blob download fallback:', error);
    // Ultimate fallback for strict environments
    window.location.href = '/api/project-zip';
    return false;
  }
}
