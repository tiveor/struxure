# IFC Compatibility

Struxure can import IFC files containing structural elements (beams, columns, members). Two extraction strategies are supported:

1. **Analytical Model** (Tier 1) — If the file contains `IfcStructuralAnalysisModel` with `IfcStructuralCurveMember` entities, Struxure extracts the analytical centerlines directly. This is the most accurate import path.

2. **Physical Elements** (Tier 2) — Falls back to extracting `IfcBeam`, `IfcColumn`, and `IfcMember` entities from their axis representation or placement geometry.

## Sample Files for Testing

### Structural Models (Recommended)

| File | Source | Type | Description |
|------|--------|------|-------------|
| [Ifc4_Revit_STR.ifc](https://github.com/youshengCode/IfcSampleFiles/blob/main/Ifc4_Revit_STR.ifc?raw=true) | youshengCode | IFC4 | Revit structural model |
| [structural-curve-member.ifc](https://github.com/buildingsmart-community/Community-Sample-Test-Files/blob/main/IFC%204.0.2.1%20(IFC%204)/ISO%20Spec%20archive/structural-curve-member.ifc?raw=true) | buildingSMART | IFC4 | Analytical model with IfcStructuralCurveMember |
| [Building-Structural.ifc](https://github.com/buildingSMART/Sample-Test-Files/blob/master/IFC%204.0.2.1%20(IFC%204)/PCERT-Sample-Scene/Building-Structural.ifc?raw=true) | buildingSMART | IFC4 | Building structural model |
| [Clinic_Structural.ifc](https://github.com/buildingsmart-community/Community-Sample-Test-Files/blob/main/IFC%202.3.0.1%20(IFC%202x3)/Medical-Dental%20Clinic/Clinic_Structural.ifc?raw=true) | buildingSMART Community | IFC2x3 | Medical clinic structural model |

### Beam & Column Examples

| File | Source | Type | Description |
|------|--------|------|-------------|
| [beam-standard-case.ifc](https://github.com/buildingsmart-community/Community-Sample-Test-Files/blob/main/IFC%204.0.2.1%20(IFC%204)/ISO%20Spec%20archive/beam-standard-case.ifc?raw=true) | ISO Spec | IFC4 | Standard beam with I-shape profile |
| [beam-extruded-solid.ifc](https://github.com/buildingsmart-community/Community-Sample-Test-Files/blob/main/IFC%204.0.2.1%20(IFC%204)/ISO%20Spec%20archive/beam-extruded-solid.ifc?raw=true) | ISO Spec | IFC4 | Beam as extruded solid |
| [beam-varying-cardinal-points.ifc](https://github.com/buildingsmart-community/Community-Sample-Test-Files/blob/main/IFC%204.0.2.1%20(IFC%204)/ISO%20Spec%20archive/beam-varying-cardinal-points.ifc?raw=true) | ISO Spec | IFC4 | Beam with cardinal point variations |
| [column-extruded-solid.ifc](https://github.com/buildingsmart-community/Community-Sample-Test-Files/blob/main/IFC%204.0.2.1%20(IFC%204)/ISO%20Spec%20archive/column-extruded-solid.ifc?raw=true) | ISO Spec | IFC4 | Column as extruded solid |

### Steel Structures

| File | Source | Type | Description |
|------|--------|------|-------------|
| [BERNTS-Staalconstructie.ifc](https://github.com/buildingsmart-community/Community-Sample-Test-Files/blob/main/IFC%202.3.0.1%20(IFC%202x3)/Schependomlaan/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/BERNTS-Staalconstructie.ifc?raw=true) | Schependomlaan | IFC2x3 | Steel structure (Staalconstructie) |
| [V_L_Constructief.ifc](https://github.com/buildingsmart-community/Community-Sample-Test-Files/blob/main/IFC%202.3.0.1%20(IFC%202x3)/Schependomlaan/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/V_L_Constructief.ifc?raw=true) | Schependomlaan | IFC2x3 | Structural construction model |

### External Repositories

| File | Source | Size | Link |
|------|--------|------|------|
| BIMCollab_Structural Steel.ifc | BIMCollab | 0.3 MB | [bimcollab.com](https://www.bimcollab.com/Files/Example-Projects/BIMcollab_ifc_models.aspx) |
| Trapelo_IFC2X3_STR.ifc | OpenIFC | 3.6 MB | [openifcmodel.cs.auckland.ac.nz](https://openifcmodel.cs.auckland.ac.nz/Model/Details/302) |
| Hospital_IFC2X3_STR.ifc | OpenIFC | 6.4 MB | [openifcmodel.cs.auckland.ac.nz](https://openifcmodel.cs.auckland.ac.nz/Model/Details/305) |

## Known Limitations

- **Architecture-only IFC files** (e.g., `Duplex_Architecture.ifc`) may contain beams/columns as decorative elements. These may import with 0 elements if their geometry lacks axis representations.
- **IFC files with only Body representations** (solid extrusions without axis lines) have limited support. Elements without extractable centerlines are skipped with a warning.
- **Non-structural entity types** like `IfcWall`, `IfcSlab`, `IfcRoof`, etc. are not imported — Struxure is a frame analysis tool.
- **Large files** (>10 MB) may take several seconds to parse due to WASM-based IFC processing.

## How to Import

1. **Open button** — Click the folder icon in the toolbar, select a `.ifc` file
2. **Drag & drop** — Drop an `.ifc` file onto the 3D viewport
3. **Review** — The import dialog shows detected elements, sections, and materials before confirming
