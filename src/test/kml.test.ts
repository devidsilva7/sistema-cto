import { describe, expect, it } from "vitest";
import { capacidade, classificarPontos, filtrarCtos, parseKml, portasLivres } from "@/lib/fgtech";

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Folder><name>CTOs</name>
    <Placemark id="pm-1"><name>CTO-ARAC-01</name><Point><coordinates>-37.7697,-4.5617,0</coordinates></Point></Placemark>
    <Placemark id="pm-2"><name>CTO-NOVA-1</name>
      <description><![CDATA[<b>Rua Grande</b>]]></description>
      <ExtendedData><Data name="Portas"><value>16</value></Data><Data name="Ocupadas"><value>4</value></Data></ExtendedData>
      <Point><coordinates>-37.7000,-4.5000,0</coordinates></Point></Placemark>
    <Placemark><name>CTO-PERTO</name><Point><coordinates>-37.76402,-4.5640,0</coordinates></Point></Placemark>
    <Placemark><name>CTO-NOVA-1</name><Point><coordinates>-37.6000,-4.4000,0</coordinates></Point></Placemark>
  </Folder>
  <Folder><name>Cabos</name>
    <Placemark><name>Cabo 1</name><LineString><coordinates>-37.1,-4.1 -37.2,-4.2</coordinates></LineString></Placemark>
  </Folder>
</Document></kml>`;

describe("parseKml", () => {
  const r = parseKml(KML);

  it("lê apenas pontos e informa o que foi ignorado", () => {
    expect(r.totalPlacemarks).toBe(5);
    expect(r.pontos).toHaveLength(4);
    expect(r.semPonto).toBe(1);
    expect(r.pastas).toEqual(["CTOs"]);
  });

  it("não presume portas quando o arquivo não informa", () => {
    expect(r.pontos[0]).toMatchObject({
      codigo: "CTO-ARAC-01",
      ref: "pm-1",
      portas_total: null,
      portas_ocupadas: null,
    });
  });

  it("usa portas e descrição quando presentes", () => {
    expect(r.pontos[1]).toMatchObject({
      portas_total: 16,
      portas_ocupadas: 4,
      descricao: "Rua Grande",
    });
    expect(r.temPortas).toBe(true);
    expect(r.campos).toEqual(["Ocupadas", "Portas"]);
  });
});

describe("classificarPontos", () => {
  const existentes = [
    { id: "a", codigo: "cto-arac-01", lat: -4.5617, lng: -37.7697, ref_externa: null },
    { id: "b", codigo: "CTO-ARAC-02", lat: -4.564, lng: -37.764, ref_externa: null },
  ];
  const c = classificarPontos(parseKml(KML).pontos, existentes);

  it("reconhece CTO já cadastrada pelo código, ignorando maiúsculas", () => {
    expect(c[0]).toMatchObject({ situacao: "igual", existenteId: "a" });
  });
  it("marca nova, duplicada por proximidade e repetida no arquivo", () => {
    expect(c[1]!.situacao).toBe("nova");
    expect(c[2]!.situacao).toBe("duplicada");
    expect(c[3]!.situacao).toBe("repetida");
  });
  it("propõe atualizar a localização quando a CTO mudou de lugar", () => {
    const [m] = classificarPontos([{ ...parseKml(KML).pontos[0]!, lat: -4.562 }], existentes);
    expect(m).toMatchObject({ situacao: "mover", existenteId: "a" });
  });
});

describe("portas", () => {
  it("trata portas desconhecidas como não confirmadas", () => {
    expect(portasLivres({ portas_total: null, portas_ocupadas: null })).toBeNull();
    expect(capacidade({ portas_total: null, portas_ocupadas: null })).toBe("desconhecida");
  });
  it("classifica capacidade", () => {
    expect(capacidade({ portas_total: 16, portas_ocupadas: 16 })).toBe("lotada");
    expect(capacidade({ portas_total: 16, portas_ocupadas: 14 })).toBe("baixa");
    expect(capacidade({ portas_total: 16, portas_ocupadas: 12 })).toBe("boa");
  });
});

describe("filtrarCtos", () => {
  const lista = [
    { codigo: "CTO-ARAC-01", nome: "Praça", bairro: "Centro", endereco: null },
    { codigo: "CTO-ARAC-10", nome: null, bairro: "Cumbe", endereco: "Estrada do Cumbe" },
  ];
  it("busca por código sem hífen e por bairro sem acento", () => {
    expect(filtrarCtos(lista, "arac10")).toHaveLength(1);
    expect(filtrarCtos(lista, "praca")).toHaveLength(1);
  });
});
