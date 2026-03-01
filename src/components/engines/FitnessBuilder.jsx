export const FitnessBuilder = {
  build(goal) {
    const core = [
      "Ziua 1: Full body (genuflexiuni, impins, ramat)",
      "Ziua 2: Full body (indreptari, impins deasupra capului, tractiuni asistate)",
      "Ziua 3: Full body + core (fandari, impins inclinat, plank)",
    ];

    if (goal === "lose") {
      return [...core, "+ 2 sesiuni cardio usor (25-35 minute) in zilele libere"];
    }

    if (goal === "gain") {
      return [...core, "Creste progresiv greutatile si mentine 7-8h somn/noapte"];
    }

    return [...core, "Mentine volum moderat si pasi zilnici 7-10k"]; 
  },
};

export default FitnessBuilder;
