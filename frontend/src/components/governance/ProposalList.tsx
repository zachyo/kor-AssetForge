"use client";

import { useState, useEffect } from "react";
import { StellarWallet } from "@/lib/stellar";
import { truncateAddress } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Clock } from "lucide-react";

export interface Proposal {
  proposal_id: number;
  asset_id: number;
  proposer: string;
  description: string;
  votes_for: number;
  votes_against: number;
  quorum_threshold: number;
  end_time: number;
  status: "Active" | "Passed" | "Rejected";
}

interface ProposalListProps {
  proposals: Proposal[];
  wallet?: StellarWallet;
  onSelect: (proposal: Proposal) => void;
}

const statusIcon = {
  Active: <Clock className="h-4 w-4 text-blue-500" />,
  Passed: <CheckCircle className="h-4 w-4 text-green-500" />,
  Rejected: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  Active: "default",
  Passed: "secondary",
  Rejected: "destructive",
};

export function ProposalList({ proposals, wallet, onSelect }: ProposalListProps) {
  if (proposals.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        No proposals yet. Be the first to create one.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {proposals.map((p) => {
        const total = p.votes_for + p.votes_against;
        const forPct = total > 0 ? Math.round((p.votes_for / total) * 100) : 0;
        const quorumPct = p.quorum_threshold > 0
          ? Math.min(100, Math.round((total / p.quorum_threshold) * 100))
          : 100;
        const timeLeft = Math.max(0, p.end_time - Math.floor(Date.now() / 1000));
        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);

        return (
          <Card
            key={p.proposal_id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelect(p)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">
                    Proposal #{p.proposal_id} — Asset {p.asset_id}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {p.description}
                  </p>
                </div>
                <Badge variant={statusVariant[p.status]} className="shrink-0 flex items-center gap-1">
                  {statusIcon[p.status]}
                  {p.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>For {forPct}%</span>
                  <span>Against {100 - forPct}%</span>
                </div>
                <Progress value={forPct} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Quorum {quorumPct}%</span>
                  <span>{total} / {p.quorum_threshold} votes</span>
                </div>
                <Progress value={quorumPct} className="h-2" />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>By {truncateAddress(p.proposer)}</span>
                {p.status === "Active" && (
                  <span>{hours}h {minutes}m remaining</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}