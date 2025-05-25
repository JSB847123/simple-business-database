// Email utility functions for sending reports

export const openEmailWithAttachment = async (blob: Blob, fileName: string): Promise<{ success: boolean; cancelled?: boolean }> => {
  try {
    // Create a File object from the blob
    const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    
    // Check if the Web Share API is available (mainly for mobile)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: '출장 데이터 수집 보고서',
          text: '출장 중 수집한 데이터 보고서입니다.',
          files: [file]
        });
        return { success: true };
      } catch (shareError: any) {
        // Check if user cancelled the share
        if (shareError.name === 'AbortError' || shareError.message.includes('cancel')) {
          return { success: false, cancelled: true };
        }
        throw shareError;
      }
    }

    // Fallback: Create mailto link with attachment info
    const subject = encodeURIComponent('출장 데이터 수집 보고서');
    const body = encodeURIComponent(`안녕하세요,

출장 중 수집한 데이터 보고서를 첨부합니다.

보고서 파일명: ${fileName}
생성 일시: ${new Date().toLocaleString('ko-KR')}

감사합니다.`);

    // For desktop browsers, try to use the mailto protocol
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    
    // Create a temporary download link for the file
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = fileName;
    downloadLink.style.display = 'none';
    
    // Add to DOM and trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Small delay to ensure download starts, then open email
    setTimeout(() => {
      window.location.href = mailtoUrl;
      URL.revokeObjectURL(url);
    }, 500);
    
    return { success: true };
    
  } catch (error) {
    console.error('Error opening email with attachment:', error);
    throw new Error('메일 앱을 열 수 없습니다. 파일을 다운로드한 후 수동으로 첨부해주세요.');
  }
};

export const isMobileDevice = (): boolean => {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const supportsWebShare = (): boolean => {
  return 'share' in navigator && 'canShare' in navigator;
}; 