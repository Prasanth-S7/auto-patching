import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

export function MetricCard({ icon, label, value }:{ icon: ReactNode; label: string; value: ReactNode }) {
    return (
        <Card>
            <CardContent className="flex min-h-24 items-center gap-3 p-4">
                <div className={cn('flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary')}>{icon}</div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <strong className="font-heading text-xl tracking-tight">{value}</strong>
                </div>
            </CardContent>
        </Card>
    )
}