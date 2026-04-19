import { Country, State } from "country-state-city"

type CountryOption = {
  name: string
  isoCode: string
}

const SORTER = new Intl.Collator("en", { sensitivity: "base" })

export function getCountryOptions(): CountryOption[] {
  return Country.getAllCountries()
    .map((country) => ({ name: country.name, isoCode: country.isoCode }))
    .sort((a, b) => SORTER.compare(a.name, b.name))
}

export function getStateOptionsByCountryName(countryName: string): string[] {
  if (!countryName) return []
  const country = Country.getAllCountries().find((item) => item.name === countryName)
  if (!country) return []
  return State.getStatesOfCountry(country.isoCode)
    .map((state) => state.name)
    .sort((a, b) => SORTER.compare(a, b))
}

