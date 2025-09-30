import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  selectedFile: File | null;
}

export function FileUpload({ onFileSelect, isUploading, uploadProgress, selectedFile }: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        if (file.size > 5 * 1024 * 1024) {
          alert("File size must be less than 5MB");
          return;
        }
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    multiple: false,
  });

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Document Upload *</label>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
          ${selectedFile && !isUploading ? "bg-muted" : ""}
        `}
      >
        <input {...getInputProps()} />
        
        {!selectedFile && !isUploading && (
          <div className="space-y-2">
            <Upload className="w-8 h-8 sm:w-12 sm:h-12 mx-auto text-muted-foreground" />
            <p className="text-xs sm:text-sm font-medium">
              {isDragActive ? "Drop the file here" : "Drag & drop your file here"}
            </p>
            <p className="text-xs text-muted-foreground">or click to browse</p>
            <p className="text-xs text-muted-foreground">Accepts: Excel, CSV, PDF (Max 5MB)</p>
          </div>
        )}

        {isUploading && (
          <div className="space-y-3">
            <FileText className="w-12 h-12 mx-auto text-primary animate-pulse" />
            <p className="text-sm font-medium">Uploading...</p>
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
          </div>
        )}

        {selectedFile && !isUploading && (
          <div className="space-y-2">
            <CheckCircle className="w-12 h-12 mx-auto text-primary" />
            <p className="text-sm font-medium text-primary">File uploaded successfully!</p>
            <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
