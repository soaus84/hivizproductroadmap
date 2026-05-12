# energy-type-taxonomy.md — Energy Type Taxonomy

**Forge Works · Hiviz SafetyPlatform — Global Reference**
Version: 1.0

> **Scope:** Authoritative definitions for the `energy_type` field used in observations and incidents. Referenced by feature specs — not copied into them.

---

## Overview

`energy_type` is assigned by the enrichment prompt and the capture conversation. It identifies the class of energy involved in an observation or incident — the physical mechanism by which harm could occur or did occur. Used in trend analysis, FW Map® classification context, and toolbox talk assembly.

**Confidence threshold:** `energy_type_confidence >= 0.70` for reliable classification. Below threshold, store the value but flag confidence in the companion field.

**Rule:** Assign the energy type most directly associated with the potential or actual harm mechanism. If multiple energy types are present, assign the one that posed the greatest harm potential. `none` is a valid value — not all observations involve an identifiable energy type.

---

## The 8 Energy Types

### `kinetic`
Energy of motion — moving objects, moving vehicles, swinging loads, projectiles, or any object in motion that could cause harm on impact.

**Examples:** Reversing heavy vehicle, swinging crane load, rotating machinery, projectile from grinding, conveyor system in motion, sliding or rolling material.

---

### `gravitational`
Potential energy from height — falling objects, persons falling, or collapses. The energy is released when an object or person loses elevation.

**Examples:** Working at height without edge protection, dropped tools or materials from elevated areas, collapse of excavation walls or stored material, falling into an open pit or excavation.

---

### `electrical`
Energy from electrical systems — shock, arc flash, or fire from electrical sources. Includes both low-voltage and high-voltage contexts.

**Examples:** Energised electrical panel accessed without isolation, overhead power line proximity, LOTO not applied before electrical work, arc flash from switchgear.

---

### `thermal`
Heat or cold energy — burns from hot surfaces, hot liquids, steam, open flame, or cold-induced injury from cryogenics or extreme cold exposure.

**Examples:** Hot work (welding, cutting) near flammable material, contact with steam lines, cryogenic substance handling, hot bitumen or molten material, heat stress from ambient temperature.

---

### `chemical`
Energy released through chemical reaction or toxicity — exposure to hazardous substances, reaction hazards, asphyxiation, or corrosion.

**Examples:** Exposure to toxic fumes in a confined space, acid or caustic spill, reactive chemical mixing, asphyxiation risk from gas accumulation, hydrocarbon release.

---

### `pressure`
Stored energy in pressurised systems — pneumatic, hydraulic, or gas pressure. Released uncontrollably when containment fails.

**Examples:** Hydraulic line failure under pressure, pneumatic tool misuse, pressurised vessel or pipeline breach, compressed gas cylinder mishandling, high-pressure water jetting.

---

### `noise_vibration`
Acoustic or vibrational energy causing harm over time or at extreme levels. Includes occupational noise exposure and whole-body or hand-arm vibration.

**Examples:** Prolonged exposure to plant noise above threshold without hearing protection, hand-arm vibration from drill use, whole-body vibration from heavy vehicle operation over extended shifts.

---

### `none`
No identifiable energy type is applicable to this observation. Used for positive performance observations, process or behavioural observations where no specific energy mechanism is involved, or when the observation is too vague to classify.

**Do not use as a default.** Only use `none` when no energy type genuinely applies after considering all 7 types.

---

## Classification Guidance

| Observation type | Typical energy type |
|---|---|
| Vehicle movement / reversing | `kinetic` |
| Working at height / dropped objects | `gravitational` |
| Electrical work / isolation | `electrical` |
| Hot work / steam / heat exposure | `thermal` |
| Hazardous substances / confined space gas | `chemical` |
| Hydraulic / pneumatic / pressurised lines | `pressure` |
| Noise exposure / vibration | `noise_vibration` |
| Process / behaviour / documentation issue with no energy mechanism | `none` |
| Positive performance with no hazard mechanism | `none` |

---

## Consumed By

| Feature | File | How used |
|---|---|---|
| Observation capture conversation | `features/OBSERVATION-CAPTURE.md` | `energy_type` field in capture summary |
| Incident capture conversation | `features/INCIDENT-CAPTURE.md` | `energy_type` field in incident summary |
| Observation enrichment | `features/OBSERVATION-CAPTURE.md` | Classification field with confidence |
| Critical insight generation | `features/CRITICAL-INSIGHT.md` | Context for pattern narrative |
| FW Map® classification | `features/CRITICAL-INSIGHT.md`, `features/INVESTIGATION.md` | Passes to `fw_classify` as context |
