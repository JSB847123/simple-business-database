import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { Location } from '../types/location';
import { dataURLtoFile, compressImage } from './imageUtils';

// Mobile detection utility
const isMobile = (): boolean => {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// iOS Safari detection
const isIOSSafari = (): boolean => {
  const userAgent = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/CriOS|FxiOS/.test(userAgent);
};

// Alternative download method for mobile
const downloadFileOnMobile = (blob: Blob, fileName: string): void => {
  try {
    // Create object URL
    const url = URL.createObjectURL(blob);
    
    if (isIOSSafari()) {
      // iOS Safari specific handling
      const reader = new FileReader();
      reader.onload = function() {
        const dataUrl = reader.result as string;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      reader.readAsDataURL(blob);
    } else {
      // Android and other mobile browsers
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      // Add to DOM and trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
    }
    
    // Cleanup URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('Mobile download failed:', error);
    // Fallback: try to open in new window
    try {
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      alert('파일 다운로드에 실패했습니다. 브라우저를 새로고침 후 다시 시도해주세요.');
    }
  }
};

// 메모리 사용량 체크
const checkMemoryUsage = (): { used: number; total: number; percentage: number } => {
  const memoryInfo = (performance as any).memory;
  if (memoryInfo) {
    return {
      used: memoryInfo.usedJSHeapSize,
      total: memoryInfo.totalJSHeapSize,
      percentage: (memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100
    };
  }
  return { used: 0, total: 0, percentage: 0 };
};

// 가비지 컬렉션 유도 함수
const forceGarbageCollection = async (): Promise<void> => {
  // 메모리 정리를 위한 짧은 지연
  await new Promise(resolve => setTimeout(resolve, 10));
};

// 안전한 이미지 압축 함수
const compressImageForDocx = async (imageData: string): Promise<string> => {
  try {
    // Base64 데이터 크기 확인
    const base64Size = (imageData.length * 3) / 4; // 대략적인 바이트 크기
    
    // 5MB 이상의 이미지는 더 강하게 압축
    if (base64Size > 5 * 1024 * 1024) {
      // 매우 큰 이미지: 800px, 품질 0.5
      const file = dataURLtoFile(imageData, 'temp.jpg');
      return await compressImage(file, 800, 0.5);
    } else if (base64Size > 2 * 1024 * 1024) {
      // 큰 이미지: 1000px, 품질 0.6
      const file = dataURLtoFile(imageData, 'temp.jpg');
      return await compressImage(file, 1000, 0.6);
    } else {
      // 작은 이미지: 1200px, 품질 0.7 (기본값)
      const file = dataURLtoFile(imageData, 'temp.jpg');
      return await compressImage(file, 1200, 0.7);
    }
  } catch (error) {
    console.warn('이미지 압축 실패, 원본 사용:', error);
    return imageData;
  }
};

// 청크 단위 이미지 처리 함수
const processImagesInChunks = async (photos: any[], onProgress?: (current: number, total: number) => void): Promise<any[]> => {
  const CHUNK_SIZE = 3; // 한번에 3장씩 처리
  const processedPhotos = [];
  
  for (let i = 0; i < photos.length; i += CHUNK_SIZE) {
    const chunk = photos.slice(i, i + CHUNK_SIZE);
    
    // 메모리 사용량 체크
    const memoryUsage = checkMemoryUsage();
    if (memoryUsage.percentage > 85) {
      console.warn(`메모리 사용량 높음: ${memoryUsage.percentage.toFixed(1)}%`);
      await forceGarbageCollection();
    }
    
    const chunkPromises = chunk.map(async (photo) => {
      try {
        // 이미지 압축 먼저 수행
        const compressedImageData = await compressImageForDocx(photo.data);
        
        // 압축된 이미지로 파일 생성
        const imageFile = dataURLtoFile(compressedImageData, photo.name);
        const imageBuffer = await imageFile.arrayBuffer();
        
        // 크기 정보 얻기
        const dimensions = await getImageDimensionsWithAspectRatio(compressedImageData);
        
        return {
          ...photo,
          processedData: imageBuffer,
          dimensions,
          originalSize: photo.data.length,
          compressedSize: compressedImageData.length
        };
      } catch (error) {
        console.error('이미지 처리 실패:', photo.name, error);
        return {
          ...photo,
          error: true,
          errorMessage: error.message
        };
      }
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    processedPhotos.push(...chunkResults);
    
    // 진행상황 알림
    if (onProgress) {
      onProgress(Math.min(i + CHUNK_SIZE, photos.length), photos.length);
    }
    
    // 청크 처리 후 메모리 정리
    await forceGarbageCollection();
  }
  
  return processedPhotos;
};

// 파일 크기 제한 상수
const MAX_DOCX_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PHOTOS_PER_LOCATION = 20; // 위치당 최대 사진 수
const WARNING_SIZE_THRESHOLD = 30 * 1024 * 1024; // 30MB

// 파일 크기 검증 함수
const validateFileSize = (blob: Blob): { valid: boolean; warning: boolean; message?: string } => {
  if (blob.size > MAX_DOCX_SIZE) {
    return {
      valid: false,
      warning: false,
      message: `파일 크기가 너무 큽니다 (${Math.round(blob.size / 1024 / 1024)}MB). 일부 이미지를 제거하거나 압축 설정을 조정해주세요.`
    };
  }
  
  if (blob.size > WARNING_SIZE_THRESHOLD) {
    return {
      valid: true,
      warning: true,
      message: `파일 크기가 큽니다 (${Math.round(blob.size / 1024 / 1024)}MB). 메일 전송 시 제한이 있을 수 있습니다.`
    };
  }
  
  return { valid: true, warning: false };
};

// 위치별 사진 수 체크
const validatePhotoCount = (locations: Location[]): { valid: boolean; message?: string } => {
  for (const location of locations) {
    const totalPhotos = location.floors.reduce((total, floor) => total + floor.photos.length, 0);
    if (totalPhotos > MAX_PHOTOS_PER_LOCATION) {
      return {
        valid: false,
        message: `"${location.locationType}"에 사진이 너무 많습니다 (${totalPhotos}장). 위치당 최대 ${MAX_PHOTOS_PER_LOCATION}장까지 권장됩니다.`
      };
    }
  }
  return { valid: true };
};

export const generateReport = async (
  locations: Location[], 
  onProgress?: (message: string, progress: number) => void,
  onWarning?: (message: string) => void
): Promise<void> => {
  try {
    if (onProgress) onProgress('유효성 검사 중...', 0);
    
    // 사진 수 검증
    const photoValidation = validatePhotoCount(locations);
    if (!photoValidation.valid && onWarning) {
      onWarning(photoValidation.message!);
    }
    
    if (onProgress) onProgress('보고서 준비 중...', 5);
    
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: await generateDocumentContent(locations, onProgress),
        },
      ],
    });

    if (onProgress) onProgress('문서 생성 중...', 90);
    
    const blob = await Packer.toBlob(doc);
    
    // 파일 크기 검증
    const sizeValidation = validateFileSize(blob);
    if (!sizeValidation.valid) {
      throw new Error(sizeValidation.message);
    }
    
    if (sizeValidation.warning && onWarning) {
      onWarning(sizeValidation.message!);
    }
    
    const fileName = `출장_데이터_수집_보고서_${new Date().toISOString().split('T')[0]}.docx`;
    
    if (onProgress) onProgress('다운로드 준비 완료', 100);
    
    // Check if mobile and use appropriate download method
    if (isMobile()) {
      downloadFileOnMobile(blob, fileName);
    } else {
      saveAs(blob, fileName);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    throw new Error('보고서 생성 중 오류가 발생했습니다: ' + error.message);
  }
};

export const generateReportForEmail = async (
  locations: Location[], 
  onProgress?: (message: string, progress: number) => void,
  onWarning?: (message: string) => void
): Promise<{ blob: Blob; fileName: string; size: number }> => {
  try {
    if (onProgress) onProgress('유효성 검사 중...', 0);
    
    // 사진 수 검증
    const photoValidation = validatePhotoCount(locations);
    if (!photoValidation.valid && onWarning) {
      onWarning(photoValidation.message!);
    }
    
    if (onProgress) onProgress('메일용 보고서 준비 중...', 5);
    
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: await generateDocumentContent(locations, onProgress),
        },
      ],
    });

    if (onProgress) onProgress('문서 생성 중...', 90);
    
    const blob = await Packer.toBlob(doc);
    
    // 파일 크기 검증
    const sizeValidation = validateFileSize(blob);
    if (!sizeValidation.valid) {
      throw new Error(sizeValidation.message);
    }
    
    if (sizeValidation.warning && onWarning) {
      onWarning(sizeValidation.message!);
    }
    
    const fileName = `출장_데이터_수집_보고서_${new Date().toISOString().split('T')[0]}.docx`;
    
    if (onProgress) onProgress('메일 준비 완료', 100);
    
    return { 
      blob, 
      fileName,
      size: blob.size
    };
  } catch (error) {
    console.error('Error generating report for email:', error);
    throw new Error('메일용 보고서 생성 중 오류가 발생했습니다: ' + error.message);
  }
};

// Helper function to get image dimensions and maintain aspect ratio
const getImageDimensionsWithAspectRatio = (imageData: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const originalWidth = img.naturalWidth;
      const originalHeight = img.naturalHeight;
      
      // Maximum dimensions for the document
      const maxWidth = 400;
      const maxHeight = 300;
      
      // Calculate aspect ratio
      const aspectRatio = originalWidth / originalHeight;
      
      let finalWidth, finalHeight;
      
      // Determine final dimensions while maintaining aspect ratio
      if (aspectRatio > maxWidth / maxHeight) {
        // Image is wider, constrain by width
        finalWidth = Math.min(originalWidth, maxWidth);
        finalHeight = finalWidth / aspectRatio;
      } else {
        // Image is taller, constrain by height
        finalHeight = Math.min(originalHeight, maxHeight);
        finalWidth = finalHeight * aspectRatio;
      }
      
      resolve({ width: Math.round(finalWidth), height: Math.round(finalHeight) });
    };
    img.onerror = () => {
      // Fallback to default dimensions if image load fails
      resolve({ width: 300, height: 225 });
    };
    img.src = imageData;
  });
};

const generateDocumentContent = async (locations: Location[], onProgress?: (message: string, progress: number) => void) => {
  const children = [];
  
  // 전체 이미지 수 계산
  const totalPhotos = locations.reduce((total, location) => {
    return total + location.floors.reduce((floorTotal, floor) => floorTotal + floor.photos.length, 0);
  }, 0);
  
  let processedPhotos = 0;

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "출장 데이터 수집 보고서",
          size: 28,
          bold: true,
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Summary
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "보고서 요약",
          size: 24,
          bold: true,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `작성 일시: ${new Date().toLocaleString('ko-KR')}`,
          size: 20,
        }),
      ],
      spacing: { after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `총 수집 장소: ${locations.length}개`,
          size: 20,
        }),
      ],
      spacing: { after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `총 첨부 사진: ${totalPhotos}장`,
          size: 20,
        }),
      ],
      spacing: { after: 300 },
    })
  );

  // Location Details - 위치별로 순차 처리
  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];
    
    if (onProgress) {
      onProgress(`${location.locationType} 처리 중... (${i + 1}/${locations.length})`, Math.round((i / locations.length) * 80));
    }

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${i + 1}. ${location.locationType}`,
            size: 22,
            bold: true,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );

    // Address
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "주소 정보",
            size: 20,
            bold: true,
          }),
        ],
        spacing: { after: 100 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `주소 및 상호명: ${location.address.addressAndName}`,
            size: 18,
          }),
        ],
        spacing: { after: 200 },
      })
    );

    // Check Items
    if (location.checkItems) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "체크사항",
              size: 20,
              bold: true,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: location.checkItems,
              size: 18,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }

    // Floor Details
    if (location.floors.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "층별 정보",
              size: 20,
              bold: true,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      for (const floor of location.floors) {
        const displayFloorName = floor.floorName === '기타' && floor.customFloorName 
          ? floor.customFloorName 
          : floor.floorName;
          
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${displayFloorName}`,
                size: 18,
                bold: true,
              }),
            ],
            spacing: { after: 50 },
          })
        );

        if (floor.floorInfo) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: floor.floorInfo,
                  size: 18,
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }

        // Photos - 청크 단위로 처리
        if (floor.photos.length > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `첨부 사진 (${floor.photos.length}장)`,
                  size: 16,
                  italics: true,
                }),
              ],
              spacing: { after: 100 },
            })
          );

          const processedPhotoData = await processImagesInChunks(
            floor.photos, 
            (current, total) => {
              processedPhotos = Math.min(processedPhotos + 1, totalPhotos);
              if (onProgress) {
                const progress = Math.round(((processedPhotos / totalPhotos) * 70) + 10);
                onProgress(`이미지 처리 중... (${processedPhotos}/${totalPhotos})`, progress);
              }
            }
          );

          for (const photoData of processedPhotoData) {
            if (photoData.error) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `[이미지 로드 실패: ${photoData.name}] - ${photoData.errorMessage}`,
                      size: 16,
                      color: "FF0000",
                    }),
                  ],
                  spacing: { after: 100 },
                })
              );
            } else {
              try {
                children.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: photoData.processedData,
                        transformation: {
                          width: photoData.dimensions.width,
                          height: photoData.dimensions.height,
                        },
                        type: "jpg",
                      }),
                    ],
                    spacing: { after: 200 },
                    alignment: AlignmentType.JUSTIFIED,
                  })
                );
              } catch (error) {
                console.error('Error adding processed image to document:', error);
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `[이미지 추가 실패: ${photoData.name}]`,
                        size: 16,
                        color: "FF0000",
                      }),
                    ],
                    spacing: { after: 100 },
                  })
                );
              }
            }
          }
        }
      }
    }

    // Notes
    if (location.notes) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "특이사항 및 메모",
              size: 20,
              bold: true,
            }),
          ],
          spacing: { before: 100, after: 100 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: location.notes,
              size: 18,
            }),
          ],
          spacing: { after: 300 },
        })
      );
    }
    
    // 위치 처리 후 메모리 정리
    await forceGarbageCollection();
  }

  return children;
};
