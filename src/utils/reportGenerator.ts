import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { Location } from '../types/location';
import { dataURLtoFile } from './imageUtils';

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

export const generateReport = async (locations: Location[]): Promise<void> => {
  try {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: await generateDocumentContent(locations),
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `출장_데이터_수집_보고서_${new Date().toISOString().split('T')[0]}.docx`;
    
    // Check if mobile and use appropriate download method
    if (isMobile()) {
      downloadFileOnMobile(blob, fileName);
    } else {
      saveAs(blob, fileName);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    throw new Error('보고서 생성 중 오류가 발생했습니다.');
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

const generateDocumentContent = async (locations: Location[]) => {
  const children = [];

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

  const totalPhotos = locations.reduce((total, location) => {
    return total + location.floors.reduce((floorTotal, floor) => floorTotal + floor.photos.length, 0);
  }, 0);

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

  // Location Details
  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];

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
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${floor.floorName}`,
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

        // Photos
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

          for (const photo of floor.photos) {
            try {
              const imageFile = dataURLtoFile(photo.data, photo.name);
              const imageBuffer = await imageFile.arrayBuffer();
              
              // Get image dimensions while maintaining aspect ratio
              const dimensions = await getImageDimensionsWithAspectRatio(photo.data);
              
              children.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: imageBuffer,
                      transformation: {
                        width: dimensions.width,
                        height: dimensions.height,
                      },
                      type: "jpg",
                    }),
                  ],
                  spacing: { after: 200 },
                  alignment: AlignmentType.JUSTIFIED,
                })
              );
            } catch (error) {
              console.error('Error adding image to document:', error);
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `[이미지 로드 실패: ${photo.name}]`,
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
  }

  return children;
};
