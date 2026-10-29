"use client";
import { Button } from "@/components/ui/button";
export function CompartirPublico({ nombre }: { nombre: string }) {
  return (
    <Button
      onClick={() =>
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`Plan ${nombre}: ${location.href}`)}`,
          "_blank",
          "noopener,noreferrer",
        )
      }
    >
      Compartir por WhatsApp
    </Button>
  );
}
