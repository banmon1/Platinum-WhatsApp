import { useMemo, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { Text, TextInput, useLanguage } from '../i18n';
import { normalizeRecipient } from '../phone';
import { ActionButton } from './UI';
import { colors } from '../theme';

export function PhoneInput({onAdd}:{onAdd:(number:string)=>void}) {
  const {language}=useLanguage();
  const [country,setCountry]=useState<CountryCode>('JO');
  const [number,setNumber]=useState('');
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState('');
  const names=useMemo(()=>new Intl.DisplayNames([language],{type:'region'}),[language]);
  const normalized=normalizeRecipient(number,country);
  const countries=getCountries().filter(code=>`${names.of(code)} ${code} +${getCountryCallingCode(code)}`.toLowerCase().includes(search.toLowerCase()));
  const add=()=>{if(normalized){onAdd(normalized);setNumber('');}};
  return <View style={{gap:10,marginBottom:16}}>
    <Text>Choose country, then enter the number</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Country code" onPress={()=>setOpen(!open)} style={{padding:14,borderRadius:16,backgroundColor:colors.canvas}}><Text>{names.of(country)} (+{getCountryCallingCode(country)}) ▾</Text></Pressable>
    {open&&<View style={{backgroundColor:colors.canvas,padding:12,borderRadius:16}}><TextInput accessibilityLabel="Search countries" placeholder="Search countries" value={search} onChangeText={setSearch} style={{padding:12}}/><ScrollView style={{maxHeight:180}}>{countries.map(code=><Pressable key={code} accessibilityRole="button" onPress={()=>{setCountry(code);setOpen(false);setSearch('');}} style={{padding:10}}><Text>{names.of(code)} (+{getCountryCallingCode(code)})</Text></Pressable>)}</ScrollView></View>}
    <TextInput accessibilityLabel="Phone number" keyboardType="phone-pad" placeholder={country==='JO'?'079 123 4567':'Phone number'} value={number} onChangeText={setNumber} onSubmitEditing={add} style={{padding:16,borderRadius:16,backgroundColor:colors.canvas,writingDirection:'ltr',textAlign:'left',fontSize:16}}/>
    <Text>With or without the leading zero. International + and 00 formats also work.</Text>
    {number.trim()&&<Text style={{color:normalized?colors.success:colors.danger,writingDirection:'ltr'}}>{normalized?`✓ ${normalized}`:'Enter a valid number for the selected country.'}</Text>}
    <ActionButton label="Add number" onPress={add} disabled={!normalized} variant="acid"/>
  </View>;
}
