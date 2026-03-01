export const LabParserEngine = {
  parse(rawText) {
    if (!rawText) {
      return {
        status: "auto",
        notes: "Analize neincarcate. Se folosesc valori implicite.",
      };
    }

    return {
      status: "provided",
      notes: `Text analize detectat (${rawText.length} caractere).`,
    };
  },
};

export default LabParserEngine;
