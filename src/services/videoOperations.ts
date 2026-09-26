// videoOperations.ts - Operações de upload e gerenciamento de vídeos para scripts
import { supabase } from './supabaseClient';

export interface VideoUploadResult {
  success: boolean;
  error?: string;
  videoUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface VideoDeleteResult {
  success: boolean;
  error?: string;
}

export class VideoOperations {
  private static readonly BUCKET_NAME = 'script-videos';
  private static readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private static readonly ALLOWED_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo' // .avi
  ];

  /**
   * Faz upload de um vídeo para o Supabase Storage
   */
  static async uploadVideo(file: File, scriptId: string): Promise<VideoUploadResult> {
    try {
      console.log('🎬 Iniciando upload de vídeo:', {
        fileName: file.name,
        size: file.size,
        type: file.type,
        scriptId
      });

      // Validação do arquivo
      const validation = this.validateVideoFile(file);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Gerar nome único do arquivo
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${scriptId}_${timestamp}_${sanitizedName}`;
      const filePath = `videos/${fileName}`;

      // Upload para o Supabase Storage
      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('❌ Erro no upload do vídeo:', error);
        return {
          success: false,
          error: `Erro no upload: ${error.message}`
        };
      }

      // Obter URL pública do vídeo
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        return {
          success: false,
          error: 'Não foi possível obter URL pública do vídeo'
        };
      }

      console.log('✅ Upload de vídeo concluído:', {
        fileName,
        url: urlData.publicUrl,
        size: file.size
      });

      return {
        success: true,
        videoUrl: urlData.publicUrl,
        fileName: fileName,
        fileSize: file.size
      };

    } catch (error) {
      console.error('❌ Erro inesperado no upload de vídeo:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Remove um vídeo do Supabase Storage
   */
  static async deleteVideo(videoUrl: string): Promise<VideoDeleteResult> {
    try {
      console.log('🗑️ Iniciando remoção de vídeo:', videoUrl);

      // Extrair caminho do arquivo da URL
      const filePath = this.extractFilePathFromUrl(videoUrl);
      if (!filePath) {
        return {
          success: false,
          error: 'URL de vídeo inválida'
        };
      }

      // Remover do Supabase Storage
      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.error('❌ Erro na remoção do vídeo:', error);
        return {
          success: false,
          error: `Erro na remoção: ${error.message}`
        };
      }

      console.log('✅ Vídeo removido com sucesso:', filePath);
      return {
        success: true
      };

    } catch (error) {
      console.error('❌ Erro inesperado na remoção de vídeo:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Lista todos os vídeos de um script específico
   */
  static async listScriptVideos(scriptId: string) {
    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list('videos', {
          search: scriptId
        });

      if (error) {
        console.error('❌ Erro ao listar vídeos do script:', error);
        return {
          success: false,
          error: error.message,
          videos: []
        };
      }

      const videos = data?.map(file => {
        const { data: urlData } = supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(`videos/${file.name}`);

        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          createdAt: file.created_at
        };
      }) || [];

      return {
        success: true,
        videos
      };

    } catch (error) {
      console.error('❌ Erro inesperado ao listar vídeos:', error);
      return {
        success: false,
        error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        videos: []
      };
    }
  }

  /**
   * Valida se o arquivo é um vídeo válido
   */
  private static validateVideoFile(file: File): { valid: boolean; error?: string } {
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
   * Utilitário para extrair extensão do arquivo
   */
  static getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Extrai ID do vídeo do YouTube de uma URL
   */
  static extractYouTubeId(url: string): string | null {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  }

  /**
   * Extrai ID do vídeo do Vimeo de uma URL
   */
  static extractVimeoId(url: string): string | null {
    const regExp = /vimeo\.com\/(\d+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  }

  /**
   * Verifica se URL é do YouTube
   */
  static isYouTubeUrl(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  /**
   * Verifica se URL é do Vimeo
   */
  static isVimeoUrl(url: string): boolean {
    return url.includes('vimeo.com');
  }

  /**
   * Gera URL de embed para YouTube
   */
  static getYouTubeEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  /**
   * Gera URL de embed para Vimeo
   */
  static getVimeoEmbedUrl(videoId: string): string {
    return `https://player.vimeo.com/video/${videoId}`;
  }
}
