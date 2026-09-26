// imageOperations.ts - Operações de upload e gerenciamento de imagens para scripts
import { supabase } from './supabaseClient';

export interface ImageUploadResult {
  success: boolean;
  error?: string;
  imageUrl?: string;
  fileName?: string;
  fileSize?: number;
  originalSize?: number;
  compressed?: boolean;
}

export interface ImageDeleteResult {
  success: boolean;
  error?: string;
}

export class ImageOperations {
  private static readonly BUCKET_NAME = 'script-images';
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_COMPRESSED_SIZE = 2 * 1024 * 1024; // 2MB target após compressão
  private static readonly COMPRESSION_QUALITY = 0.8; // 80% de qualidade
  private static readonly MAX_DIMENSION = 1920; // Dimensão máxima (largura ou altura)

  private static readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp'
  ];

  /**
   * Faz upload de uma imagem para o Supabase Storage com compressão automática
   */
  static async uploadImage(file: File, scriptId: string): Promise<ImageUploadResult> {
    try {
      console.log('🖼️ Iniciando upload de imagem:', {
        fileName: file.name,
        size: file.size,
        type: file.type,
        scriptId
      });

      // Validação do arquivo
      const validation = this.validateImageFile(file);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const originalSize = file.size;
      let processedFile = file;
      let compressed = false;

      // Comprimir imagem se necessário (não comprimir GIF e SVG)
      if (file.size > this.MAX_COMPRESSED_SIZE && !file.type.includes('gif') && !file.type.includes('svg')) {
        console.log('🗜️ Comprimindo imagem...');
        const compressionResult = await this.compressImage(file);
        if (compressionResult.success && compressionResult.file) {
          processedFile = compressionResult.file;
          compressed = true;
          console.log('✅ Imagem comprimida:', {
            originalSize: originalSize,
            compressedSize: processedFile.size,
            reduction: Math.round((1 - processedFile.size / originalSize) * 100) + '%'
          });
        }
      }

      // Gerar nome único do arquivo
      const timestamp = Date.now();
      const sanitizedName = processedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${scriptId}_${timestamp}_${sanitizedName}`;
      const filePath = `images/${fileName}`;

      // Upload para o Supabase Storage
      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, processedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('❌ Erro no upload da imagem:', error);
        return {
          success: false,
          error: `Erro no upload: ${error.message}`
        };
      }

      // Obter URL pública da imagem
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        return {
          success: false,
          error: 'Não foi possível obter URL pública da imagem'
        };
      }

      console.log('✅ Upload de imagem concluído:', {
        fileName,
        url: urlData.publicUrl,
        originalSize,
        finalSize: processedFile.size,
        compressed
      });

      return {
        success: true,
        imageUrl: urlData.publicUrl,
        fileName: fileName,
        fileSize: processedFile.size,
        originalSize,
        compressed
      };

    } catch (error) {
      console.error('❌ Erro inesperado no upload de imagem:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Comprime uma imagem mantendo boa qualidade visual
   */
  private static async compressImage(file: File): Promise<{ success: boolean; file?: File; error?: string }> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // Calcular novas dimensões mantendo aspect ratio
          const { width, height } = this.calculateDimensions(img.width, img.height);

          canvas.width = width;
          canvas.height = height;

          // Desenhar imagem redimensionada
          ctx?.drawImage(img, 0, 0, width, height);

          // Converter para blob com compressão
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });

                resolve({
                  success: true,
                  file: compressedFile
                });
              } else {
                resolve({
                  success: false,
                  error: 'Erro na compressão da imagem'
                });
              }
            },
            'image/jpeg',
            this.COMPRESSION_QUALITY
          );
        } catch (error) {
          resolve({
            success: false,
            error: `Erro no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          });
        }
      };

      img.onerror = () => {
        resolve({
          success: false,
          error: 'Erro ao carregar imagem para compressão'
        });
      };

      // Carregar imagem
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calcula dimensões otimizadas mantendo aspect ratio
   */
  private static calculateDimensions(originalWidth: number, originalHeight: number): { width: number; height: number } {
    if (originalWidth <= this.MAX_DIMENSION && originalHeight <= this.MAX_DIMENSION) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;

    if (originalWidth > originalHeight) {
      return {
        width: this.MAX_DIMENSION,
        height: Math.round(this.MAX_DIMENSION / aspectRatio)
      };
    } else {
      return {
        width: Math.round(this.MAX_DIMENSION * aspectRatio),
        height: this.MAX_DIMENSION
      };
    }
  }

  /**
   * Remove uma imagem do Supabase Storage
   */
  static async deleteImage(imageUrl: string): Promise<ImageDeleteResult> {
    try {
      console.log('🗑️ Iniciando remoção de imagem:', imageUrl);

      // Extrair caminho do arquivo da URL
      const filePath = this.extractFilePathFromUrl(imageUrl);
      if (!filePath) {
        return {
          success: false,
          error: 'URL de imagem inválida'
        };
      }

      // Remover do Supabase Storage
      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.error('❌ Erro na remoção da imagem:', error);
        return {
          success: false,
          error: `Erro na remoção: ${error.message}`
        };
      }

      console.log('✅ Imagem removida com sucesso:', filePath);
      return {
        success: true
      };

    } catch (error) {
      console.error('❌ Erro inesperado na remoção de imagem:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Lista todas as imagens de um script específico
   */
  static async listScriptImages(scriptId: string) {
    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list('images', {
          search: scriptId
        });

      if (error) {
        console.error('❌ Erro ao listar imagens do script:', error);
        return {
          success: false,
          error: error.message,
          images: []
        };
      }

      const images = data?.map(file => {
        const { data: urlData } = supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(`images/${file.name}`);

        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          createdAt: file.created_at
        };
      }) || [];

      return {
        success: true,
        images
      };

    } catch (error) {
      console.error('❌ Erro inesperado ao listar imagens:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        images: []
      };
    }
  }

  /**
   * Valida se o arquivo é uma imagem válida
   */
  private static validateImageFile(file: File): { valid: boolean; error?: string } {
    // Verificar tipo de arquivo
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Tipo de arquivo não suportado. Use: ${this.ALLOWED_TYPES.join(', ')}`
      };
    }

    // Verificar tamanho do arquivo
    if (file.size > this.MAX_FILE_SIZE) {
      const maxSizeMB = this.MAX_FILE_SIZE / (1024 * 1024);
      return {
        valid: false,
        error: `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`
      };
    }

    // Verificar se o arquivo não está vazio
    if (file.size === 0) {
      return {
        valid: false,
        error: 'Arquivo está vazio'
      };
    }

    return { valid: true };
  }

  /**
   * Extrai o caminho do arquivo da URL pública do Supabase
   */
  private static extractFilePathFromUrl(url: string): string | null {
    try {
      // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
      const urlParts = url.split('/storage/v1/object/public/');
      if (urlParts.length !== 2) return null;

      const [bucketAndPath] = urlParts[1].split('/', 1);
      if (bucketAndPath !== this.BUCKET_NAME) return null;

      // Retornar apenas o caminho após o bucket
      return urlParts[1].substring(bucketAndPath.length + 1);
    } catch {
      return null;
    }
  }

  /**
   * Utilitário para formatar tamanho de arquivo
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Utilitário para verificar se string é uma URL de imagem válida
   */
  static isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

      return imageExtensions.some(ext => pathname.endsWith(ext)) ||
             url.includes('supabase');
    } catch {
      return false;
    }
  }
}
