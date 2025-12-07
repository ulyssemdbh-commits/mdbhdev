import { BonPlanCard } from "../client/BonPlanCard";

export default function BonPlanCardExample() {
  return (
    <BonPlanCard
      bonPlan={{
        id: "1",
        title: "-20% sur les viennoiseries",
        description: "Profitez de 20% de réduction sur toutes les viennoiseries du matin",
        merchantName: "Boulangerie Antoine",
        category: "Alimentation",
        discount: "-20%",
        validUntil: "31 déc.",
      }}
      onViewOffer={() => console.log("View offer clicked")}
    />
  );
}
