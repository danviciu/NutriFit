import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 30,
    paddingHorizontal: 26,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#10231c",
    backgroundColor: "#f8fffb",
  },
  hero: {
    borderRadius: 14,
    backgroundColor: "#e8f8f1",
    borderWidth: 1,
    borderColor: "#b8e8d0",
    padding: 14,
    marginBottom: 12,
  },
  badge: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: "#137851",
    marginBottom: 4,
    fontWeight: "bold",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#35534a",
    lineHeight: 1.3,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cdeedd",
    backgroundColor: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: {
    fontSize: 8,
    color: "#1e3a30",
  },
  section: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#dceee5",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#173e31",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  kpiCard: {
    width: "48.5%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d6ede2",
    backgroundColor: "#f4fcf8",
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 7,
  },
  kpiLabel: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#3d5a51",
  },
  kpiValue: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: "bold",
    color: "#12372c",
  },
  macroRow: {
    marginBottom: 7,
  },
  macroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  macroLabel: {
    fontSize: 9,
    color: "#27443b",
  },
  macroValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#173e31",
  },
  barTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: "#deeee7",
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 8,
    backgroundColor: "#1fba78",
  },
  barFillAlt: {
    height: 8,
    borderRadius: 8,
    backgroundColor: "#1f86c7",
  },
  barFillWarm: {
    height: 8,
    borderRadius: 8,
    backgroundColor: "#d88d2f",
  },
  blockText: {
    fontSize: 9,
    color: "#27443b",
    lineHeight: 1.4,
    marginBottom: 4,
  },
  dayCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dceee5",
    backgroundColor: "#f7fcfa",
    padding: 8,
    marginBottom: 7,
  },
  dayTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#173e31",
  },
  mealText: {
    fontSize: 8.5,
    marginBottom: 2,
    color: "#2b4a40",
    lineHeight: 1.3,
  },
  listCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dceee5",
    backgroundColor: "#ffffff",
    padding: 8,
    marginBottom: 7,
  },
  listItem: {
    fontSize: 8.5,
    color: "#2b4a40",
    marginBottom: 2,
    lineHeight: 1.3,
  },
  disclaimer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#d9ece2",
    paddingTop: 8,
    fontSize: 8,
    color: "#4a6b5f",
    lineHeight: 1.35,
  },
  footer: {
    position: "absolute",
    bottom: 12,
    left: 26,
    right: 26,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#5d7d71",
  },
});

function labelGoal(goal) {
  if (goal === "lose") return "Slabire";
  if (goal === "gain") return "Masa musculara";
  return "Mentinere";
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function macroItems(plan) {
  const protein = toNumber(plan?.targets?.protein);
  const carbs = toNumber(plan?.targets?.carbs);
  const fat = toNumber(plan?.targets?.fat);
  const fibre = toNumber(plan?.targets?.fibre);

  return [
    { label: "Proteine", value: protein, unit: "g", progress: Math.min(100, Math.round((protein / 220) * 100)), tone: "green" },
    { label: "Carbohidrati", value: carbs, unit: "g", progress: Math.min(100, Math.round((carbs / 360) * 100)), tone: "blue" },
    { label: "Grasimi", value: fat, unit: "g", progress: Math.min(100, Math.round((fat / 130) * 100)), tone: "orange" },
    { label: "Fibre", value: fibre, unit: "g", progress: Math.min(100, Math.round((fibre / 50) * 100)), tone: "green" },
  ];
}

function mealLine(meal) {
  const foods = Array.isArray(meal?.foods) ? meal.foods.slice(0, 4).join(", ") : "fara detalii";
  return `${meal?.slot || "Masa"}: ${foods}`;
}

export default function PlanPdf({ profile, plan }) {
  const macros = macroItems(plan || {});
  const weekly = Array.isArray(plan?.weeklyPlan) ? plan.weeklyPlan : [];
  const shopping = Array.isArray(plan?.shoppingList) ? plan.shoppingList : [];
  const fitness = Array.isArray(plan?.fitness) ? plan.fitness : [];
  const warnings = Array.isArray(plan?.warnings) ? plan.warnings : [];
  const notes = Array.isArray(plan?.notes) ? plan.notes : [];

  const profileWeight = profile?.weight_kg || profile?.weightKg || "-";
  const profileHeight = profile?.height_cm || profile?.heightCm || "-";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.badge}>NutriFit Visual Plan</Text>
          <Text style={styles.title}>Plan Personalizat</Text>
          <Text style={styles.subtitle}>{plan?.summary || "Plan nutritional si de antrenament construit pe baza profilului tau."}</Text>

          <View style={styles.chipRow}>
            <View style={styles.chip}><Text style={styles.chipText}>Sex: {profile?.sex === "male" ? "Masculin" : "Feminin"}</Text></View>
            <View style={styles.chip}><Text style={styles.chipText}>Varsta: {profile?.age || "-"}</Text></View>
            <View style={styles.chip}><Text style={styles.chipText}>Inaltime: {profileHeight} cm</Text></View>
            <View style={styles.chip}><Text style={styles.chipText}>Greutate: {profileWeight} kg</Text></View>
            <View style={styles.chip}><Text style={styles.chipText}>Obiectiv: {labelGoal(profile?.goal)}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Semnal metabolic</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>BMR</Text>
              <Text style={styles.kpiValue}>{plan?.targets?.bmr || "-"}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>TDEE</Text>
              <Text style={styles.kpiValue}>{plan?.targets?.tdee || "-"}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Tinta calorica</Text>
              <Text style={styles.kpiValue}>{plan?.targets?.kcal || "-"} kcal</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Mese / zi</Text>
              <Text style={styles.kpiValue}>{weekly?.[0]?.meals?.length || 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grafice macronutrienti</Text>
          {macros.map((macro) => (
            <View key={macro.label} style={styles.macroRow}>
              <View style={styles.macroTop}>
                <Text style={styles.macroLabel}>{macro.label}</Text>
                <Text style={styles.macroValue}>{macro.value} {macro.unit} ({macro.progress}%)</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    macro.tone === "blue" ? styles.barFillAlt : macro.tone === "orange" ? styles.barFillWarm : styles.barFill,
                    { width: `${macro.progress}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observatii clinice si avertismente</Text>
          {(notes.length ? notes.slice(0, 4) : ["Nu exista note suplimentare in plan."]).map((note, idx) => (
            <Text key={`note-${idx}`} style={styles.blockText}>- {note}</Text>
          ))}
          {(warnings.length ? warnings.slice(0, 4) : ["Fara avertismente specifice."]).map((warning, idx) => (
            <Text key={`warn-${idx}`} style={styles.blockText}>- {warning}</Text>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          Acest plan are caracter informativ si nu inlocuieste consultul medical sau nutritional. Pentru valori anormale ori
          afectiuni diagnosticate, consulta medicul specialist.
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>NutriFit Visual Engine</Text>
          <Text style={styles.footerText}>Pagina 1/2</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.badge}>Operational Blueprint</Text>
          <Text style={styles.title}>Plan 7 zile + executie</Text>
          <Text style={styles.subtitle}>Detalii zilnice pentru alimentatie, fitness si lista de cumparaturi.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Structura zilnica mese</Text>
          {weekly.length ? (
            weekly.map((day, dayIndex) => (
              <View key={`${day.day || "Zi"}-${dayIndex}`} style={styles.dayCard}>
                <Text style={styles.dayTitle}>{day.day || `Ziua ${dayIndex + 1}`}</Text>
                {(day.meals || []).slice(0, 4).map((meal, mealIndex) => (
                  <Text key={`${day.day || dayIndex}-meal-${mealIndex}`} style={styles.mealText}>- {mealLine(meal)}</Text>
                ))}
              </View>
            ))
          ) : (
            <Text style={styles.blockText}>Nu exista structurare de zile in plan.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lista cumparaturi</Text>
          <View style={styles.kpiGrid}>
            {(shopping.length ? shopping : [{ item: "Lista goala", quantity: "-" }]).slice(0, 16).map((item, idx) => (
              <View key={`shop-${idx}`} style={styles.listCard}>
                <Text style={styles.listItem}>- {item.item || item.name || "Item"}</Text>
                <Text style={styles.listItem}>Cantitate: {item.quantity || item.amount || "-"}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fitness focus</Text>
          {(fitness.length ? fitness : ["Nu exista recomandari fitness specifice."]).slice(0, 8).map((item, idx) => (
            <Text key={`fit-${idx}`} style={styles.blockText}>- {item}</Text>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          Pentru rezultate consistente, revizuieste planul la fiecare actualizare de analize, schimbare de obiectiv sau
          modificare majora a stilului de viata.
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>NutriFit Visual Engine</Text>
          <Text style={styles.footerText}>Pagina 2/2</Text>
        </View>
      </Page>
    </Document>
  );
}
