"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Search, AlertCircle, RefreshCw } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult?: (code: string) => void;
}

export function ScannerModal({ isOpen, onClose, onScanResult }: ScannerModalProps) {
  const [manualCode, setManualCode] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const router = useRouter();
  const { currentOrg } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    let active = true;

    if (isOpen) {
      setCameraError(null);
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      // Start decoding from video device
      codeReader
        .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
          if (!active) return;
          if (result) {
            const scannedText = result.getText();
            handleFoundCode(scannedText);
          }
        })
        .catch((err) => {
          console.warn("Camera init error:", err);
          if (active) {
            setCameraError(
              "Camera unavailable or permission denied. Please enter the code manually below."
            );
          }
        });
    }

    return () => {
      active = false;
      if (codeReaderRef.current) {
        // Stop camera tracks
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
        }
      }
    };
  }, [isOpen]);

  const handleFoundCode = async (code: string) => {
    if (!code || isSearching) return;
    setIsSearching(true);

    if (onScanResult) {
      onScanResult(code);
      setIsSearching(false);
      onClose();
      return;
    }

    // Default intelligent lookup: search Products or Assets
    try {
      const orgId = currentOrg?.id;

      // 1. Search Assets by asset_tag, barcode, or serial_number
      let assetQuery = supabase.from("assets").select("id, asset_tag, serial_number");
      if (orgId) assetQuery = assetQuery.eq("organization_id", orgId);
      const { data: assets } = await assetQuery
        .or(`asset_tag.eq.${code},barcode.eq.${code},serial_number.eq.${code}`)
        .limit(1);

      if (assets && assets.length > 0) {
        toast.success(`Asset found: ${assets[0].asset_tag}`);
        router.push(`/assets?search=${encodeURIComponent(assets[0].asset_tag)}`);
        onClose();
        return;
      }

      // 2. Search Products by SKU or barcode
      let prodQuery = supabase.from("products").select("id, name, sku");
      if (orgId) prodQuery = prodQuery.eq("organization_id", orgId);
      const { data: products } = await prodQuery
        .or(`sku.eq.${code},barcode.eq.${code}`)
        .limit(1);

      if (products && products.length > 0) {
        toast.success(`Product found: ${products[0].name}`);
        router.push(`/products?search=${encodeURIComponent(products[0].sku)}`);
        onClose();
        return;
      }

      toast.info(`No item found matching "${code}". You can register it or check spelling.`);
    } catch (err: any) {
      toast.error(`Lookup failed: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleFoundCode(manualCode.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Barcode & QR Scanner
          </DialogTitle>
          <DialogDescription>
            Point your device camera at a barcode or QR code to look up items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera Viewfinder */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black border flex items-center justify-center">
            {cameraError ? (
              <div className="p-4 text-center text-xs text-rose-300 flex flex-col items-center gap-2">
                <AlertCircle className="h-6 w-6 text-rose-400" />
                <span>{cameraError}</span>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                />
                {/* Viewfinder Target Overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-32 w-56 border-2 border-dashed border-blue-400/80 rounded-lg animate-pulse" />
                </div>
              </>
            )}

            {isSearching && (
              <div className="absolute inset-0 bg-black/75 flex items-center justify-center text-white text-xs gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                Querying database...
              </div>
            )}
          </div>

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              placeholder="Enter SKU, Asset Tag, or Barcode..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="text-sm"
            />
            <Button type="submit" size="sm" disabled={!manualCode.trim() || isSearching} className="gap-1.5">
              <Search className="h-4 w-4" />
              Find
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
