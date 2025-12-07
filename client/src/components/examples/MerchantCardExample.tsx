import { MerchantCard } from "../client/MerchantCard";

export default function MerchantCardExample() {
  return (
    <MerchantCard
      merchant={{
        id: "1",
        name: "Boulangerie Antoine",
        category: "Alimentation",
        address: "12 rue du Commerce",
        distance: "150m",
        visited: true,
        hasBonsPlan: true,
      }}
      onClick={() => console.log("Merchant clicked")}
    />
  );
}
