"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateBarcodeDataUrl, generateQRCodeDataUrl } from "@/lib/barcode/generator";
import { Printer, Download, QrCode, Barcode as BarcodeIcon } from "lucide-react";
import { toast } from "sonner";

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  code: string; // SKU, Barcode, or Asset Tag
  secondaryText?: string; // Product name, serial, etc.
  orgName?: string;
  type?: "product" | "asset";
}

export function BarcodeModal({
  isOpen,
  onClose,
  title,
  code,
  secondaryText,
  orgName = "INVENTORY OS",
  type = "product",
}: BarcodeModalProps) {
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"barcode" | "qrcode">("barcode");
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && code) {
      generateBarcodeDataUrl(code).then(setBarcodeDataUrl);
      generateQRCodeDataUrl(code).then(setQrDataUrl);
    }
  }, [isOpen, code]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const dataUrl = activeTab === "barcode" ? barcodeDataUrl : qrDataUrl;
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${code}_${activeTab}.png`;
    a.click();
    toast.success("Image downloaded");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarcodeIcon className="h-5 w-5 text-blue-600" />
            Item Label & Codes
          </DialogTitle>
          <DialogDescription>
            Scan, download, or print official thermal label tags.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-2 border-b pb-3">
          <Button
            size="sm"
            variant={activeTab === "barcode" ? "default" : "outline"}
            onClick={() => setActiveTab("barcode")}
            className="gap-1.5"
          >
            <BarcodeIcon className="h-4 w-4" />
            1D Barcode (Code128)
          </Button>
          <Button
            size="sm"
            variant={activeTab === "qrcode" ? "default" : "outline"}
            onClick={() => setActiveTab("qrcode")}
            className="gap-1.5"
          >
            <QrCode className="h-4 w-4" />
            2D QR Code
          </Button>
        </div>

        {/* Printable Label Card */}
        <div
          ref={printAreaRef}
          className="border border-slate-300 rounded-lg p-5 bg-white text-slate-900 flex flex-col items-center justify-center text-center shadow-sm"
        >
          <div className="text-[10px] tracking-wider uppercase font-bold text-slate-500 mb-1">
            {orgName}
          </div>
          <div className="font-semibold text-sm line-clamp-1 mb-2">{title}</div>

          {activeTab === "barcode" ? (
            barcodeDataUrl ? (
              <img
                src={barcodeDataUrl}
                alt={`Barcode ${code}`}
                className="max-h-24 w-auto object-contain my-2"
              />
            ) : (
              <div className="h-20 flex items-center justify-center text-xs text-slate-400">
                Generating barcode...
              </div>
            )
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code ${code}`}
              className="h-32 w-32 object-contain my-2"
            />
          ) : (
            <div className="h-24 flex items-center justify-center text-xs text-slate-400">
              Generating QR Code...
            </div>
          )}

          <div className="text-xs font-mono font-bold tracking-wider mt-1">{code}</div>
          {secondaryText && (
            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              {secondaryText}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row justify-between sm:justify-between items-center w-full">
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
            <Download className="h-4 w-4" />
            Save PNG
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
              <Printer className="h-4 w-4" />
              Print Label
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
