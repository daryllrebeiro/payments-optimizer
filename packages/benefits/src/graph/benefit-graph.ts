import { BenefitGraphNode, BenefitGraphEdge, PartnerBenefit } from '../domain/types.js';

export class BenefitGraph {
  private nodes = new Map<string, BenefitGraphNode>();
  private outgoingEdges = new Map<string, BenefitGraphEdge[]>();
  private incomingEdges = new Map<string, BenefitGraphEdge[]>();

  addNode(node: BenefitGraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.outgoingEdges.has(node.id)) {
      this.outgoingEdges.set(node.id, []);
    }
    if (!this.incomingEdges.has(node.id)) {
      this.incomingEdges.set(node.id, []);
    }
  }

  addEdge(edge: BenefitGraphEdge): void {
    if (!this.nodes.has(edge.fromNodeId)) {
      throw new Error(`Source node ${edge.fromNodeId} does not exist in BenefitGraph`);
    }
    if (!this.nodes.has(edge.toNodeId)) {
      throw new Error(`Target node ${edge.toNodeId} does not exist in BenefitGraph`);
    }

    const outgoing = this.outgoingEdges.get(edge.fromNodeId) || [];
    outgoing.push(edge);
    this.outgoingEdges.set(edge.fromNodeId, outgoing);

    const incoming = this.incomingEdges.get(edge.toNodeId) || [];
    incoming.push(edge);
    this.incomingEdges.set(edge.toNodeId, incoming);
  }

  getNode(id: string): BenefitGraphNode | undefined {
    return this.nodes.get(id);
  }

  getOutgoingEdges(nodeId: string): BenefitGraphEdge[] {
    return this.outgoingEdges.get(nodeId) || [];
  }

  getIncomingEdges(nodeId: string): BenefitGraphEdge[] {
    return this.incomingEdges.get(nodeId) || [];
  }

  /**
   * Traverse incoming benefit edges to a merchant to discover all partner benefits
   * available for a user's active membership programs.
   */
  getMerchantBenefitsForPrograms(
    merchantId: string,
    activeProgramIds: string[]
  ): { programId: string; benefit: PartnerBenefit }[] {
    const results: { programId: string; benefit: PartnerBenefit }[] = [];
    const activeSet = new Set(activeProgramIds);

    const incoming = this.getIncomingEdges(merchantId);
    for (const edge of incoming) {
      if (
        (edge.relation === 'BENEFITS_AT' || edge.relation === 'PARTNER_OF') &&
        edge.benefit &&
        activeSet.has(edge.fromNodeId)
      ) {
        results.push({
          programId: edge.fromNodeId,
          benefit: edge.benefit,
        });
      }
    }

    return results;
  }

  /**
   * Discovers all merchants that partner with a given program.
   */
  getPartnerMerchantsForProgram(programId: string): BenefitGraphNode[] {
    const outgoing = this.getOutgoingEdges(programId);
    const merchants: BenefitGraphNode[] = [];

    for (const edge of outgoing) {
      if (edge.relation === 'PARTNER_OF' || edge.relation === 'BENEFITS_AT') {
        const targetNode = this.nodes.get(edge.toNodeId);
        if (targetNode && targetNode.type === 'MERCHANT') {
          merchants.push(targetNode);
        }
      }
    }

    return merchants;
  }
}
