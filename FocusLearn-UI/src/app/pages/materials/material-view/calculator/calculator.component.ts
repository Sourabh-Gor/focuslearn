// calculator.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-calculator',
  imports: [MatSelectModule, CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, MatToolbarModule],
  standalone: true,
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss']
})
export class CalculatorComponent implements OnInit {
  display = '0';
  currentValue = '0';
  previousValue = '0';
  operation: string | null = null;
  waitForOperand = false;
  memory = '0';
  history: string[] = [];
  showHistory = false;
  
  // Scientific mode
  isScientificMode = false;
  isDegreeMode = true;
  
  // Conversion mode
  isConversionMode = false;
  conversionType = 'length';
  conversionTypes = ['length', 'weight', 'temperature', 'area', 'volume', 'time'];
  fromUnit = '';
  toUnit = '';
  conversionValue = '';
  conversionResult = '';
  
  // Unit mappings for conversions
  unitMappings: { [key: string]: string[] } = {
    'length': ['meter', 'kilometer', 'centimeter', 'millimeter', 'mile', 'yard', 'foot', 'inch'],
    'weight': ['kilogram', 'gram', 'milligram', 'pound', 'ounce', 'ton'],
    'temperature': ['celsius', 'fahrenheit', 'kelvin'],
    'area': ['square meter', 'square kilometer', 'square mile', 'square yard', 'square foot', 'acre', 'hectare'],
    'volume': ['cubic meter', 'liter', 'milliliter', 'gallon', 'quart', 'pint', 'cup'],
    'time': ['second', 'minute', 'hour', 'day', 'week', 'month', 'year']
  };
  constructor(public dialogRef: MatDialogRef<CalculatorComponent>,) { }
  
  ngOnInit() {
    this.resetCalculator();
  }
  
  resetCalculator() {
    this.display = '0';
    this.currentValue = '0';
    this.previousValue = '0';
    this.operation = null;
    this.waitForOperand = false;
  }
  
  inputDigit(digit: string) {
    if (this.waitForOperand) {
      this.currentValue = digit;
      this.waitForOperand = false;
    } else {
      this.currentValue = this.currentValue === '0' ? digit : this.currentValue + digit;
    }
    this.display = this.currentValue;
  }
  
  inputDecimal() {
    if (this.waitForOperand) {
      this.currentValue = '0.';
      this.waitForOperand = false;
    } else if (this.currentValue.indexOf('.') === -1) {
      this.currentValue += '.';
    }
    this.display = this.currentValue;
  }
  
  handleOperator(nextOperator: string) {
    const inputValue = parseFloat(this.currentValue);
    
    if (this.operation && !this.waitForOperand) {
      this.calculate();
    } else {
      this.previousValue = this.currentValue;
    }
    
    this.operation = nextOperator;
    this.waitForOperand = true;
  }
  
  calculate() {
    const previousValue = parseFloat(this.previousValue);
    const currentValue = parseFloat(this.currentValue);
    
    let result = 0;
    
    switch (this.operation) {
      case '+':
        result = previousValue + currentValue;
        break;
      case '-':
        result = previousValue - currentValue;
        break;
      case '*':
        result = previousValue * currentValue;
        break;
      case '/':
        if (currentValue === 0) {
          this.display = 'Error';
          return;
        }
        result = previousValue / currentValue;
        break;
      case '^':
        result = Math.pow(previousValue, currentValue);
        break;
      default:
        result = currentValue;
    }
    
    this.history.push(`${this.previousValue} ${this.operation} ${this.currentValue} = ${result}`);
    
    this.currentValue = String(result);
    this.display = this.currentValue;
    this.operation = null;
  }
  
  clearEntry() {
    this.currentValue = '0';
    this.display = '0';
  }
  
  allClear() {
    this.resetCalculator();
  }
  
  toggleSign() {
    this.currentValue = String(-parseFloat(this.currentValue));
    this.display = this.currentValue;
  }
  
  percentage() {
    const value = parseFloat(this.currentValue);
    this.currentValue = String(value / 100);
    this.display = this.currentValue;
  }
  
  // Scientific functions
  toggleScientificMode() {
    this.isScientificMode = !this.isScientificMode;
    this.isConversionMode = false;
  }
  
  toggleAngleMode() {
    this.isDegreeMode = !this.isDegreeMode;
  }
  
  calculateSin() {
    let value = parseFloat(this.currentValue);
    if (this.isDegreeMode) {
      value = value * (Math.PI / 180);
    }
    this.currentValue = String(Math.sin(value));
    this.display = this.currentValue;
  }
  
  calculateCos() {
    let value = parseFloat(this.currentValue);
    if (this.isDegreeMode) {
      value = value * (Math.PI / 180);
    }
    this.currentValue = String(Math.cos(value));
    this.display = this.currentValue;
  }
  
  calculateTan() {
    let value = parseFloat(this.currentValue);
    if (this.isDegreeMode) {
      value = value * (Math.PI / 180);
    }
    this.currentValue = String(Math.tan(value));
    this.display = this.currentValue;
  }
  
  calculateLog() {
    const value = parseFloat(this.currentValue);
    if (value <= 0) {
      this.display = 'Error';
      return;
    }
    this.currentValue = String(Math.log10(value));
    this.display = this.currentValue;
  }
  
  calculateLn() {
    const value = parseFloat(this.currentValue);
    if (value <= 0) {
      this.display = 'Error';
      return;
    }
    this.currentValue = String(Math.log(value));
    this.display = this.currentValue;
  }
  
  calculateSqrt() {
    const value = parseFloat(this.currentValue);
    if (value < 0) {
      this.display = 'Error';
      return;
    }
    this.currentValue = String(Math.sqrt(value));
    this.display = this.currentValue;
  }
  
  calculatePi() {
    this.currentValue = String(Math.PI);
    this.display = this.currentValue;
  }
  
  calculateE() {
    this.currentValue = String(Math.E);
    this.display = this.currentValue;
  }
  
  calculateFactorial() {
    const n = parseInt(this.currentValue);
    if (n < 0 || !Number.isInteger(n)) {
      this.display = 'Error';
      return;
    }
    
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    
    this.currentValue = String(result);
    this.display = this.currentValue;
  }
  
  // Memory functions
  memoryAdd() {
    this.memory = String(parseFloat(this.memory) + parseFloat(this.currentValue));
  }
  
  memorySubtract() {
    this.memory = String(parseFloat(this.memory) - parseFloat(this.currentValue));
  }
  
  memoryRecall() {
    this.currentValue = this.memory;
    this.display = this.currentValue;
    this.waitForOperand = false;
  }
  
  memoryClear() {
    this.memory = '0';
  }
  
  // Conversion functions
  toggleConversionMode() {
    this.isConversionMode = !this.isConversionMode;
    this.isScientificMode = false;
    this.resetConversion();
  }
  
  resetConversion() {
    this.conversionValue = '';
    this.conversionResult = '';
    if (this.unitMappings[this.conversionType]) {
      this.fromUnit = this.unitMappings[this.conversionType][0];
      this.toUnit = this.unitMappings[this.conversionType][1];
    }
  }
  
  changeConversionType(type: string) {
    this.conversionType = type;
    this.resetConversion();
  }
  
  convert() {
    if (!this.conversionValue || isNaN(parseFloat(this.conversionValue))) {
      this.conversionResult = 'Invalid input';
      return;
    }
    
    const value = parseFloat(this.conversionValue);
    let result = 0;
    
    // Convert to base unit first
    let baseValue = this.convertToBaseUnit(value, this.fromUnit, this.conversionType);
    // Then convert from base unit to target unit
    result = this.convertFromBaseUnit(baseValue, this.toUnit, this.conversionType);
    
    this.conversionResult = result.toString();
  }
  
  convertToBaseUnit(value: number, unit: string, type: string): number {
    switch (type) {
      case 'length':
        switch (unit) {
          case 'meter': return value;
          case 'kilometer': return value * 1000;
          case 'centimeter': return value * 0.01;
          case 'millimeter': return value * 0.001;
          case 'mile': return value * 1609.34;
          case 'yard': return value * 0.9144;
          case 'foot': return value * 0.3048;
          case 'inch': return value * 0.0254;
        }
        break;
      case 'weight':
        switch (unit) {
          case 'kilogram': return value;
          case 'gram': return value * 0.001;
          case 'milligram': return value * 0.000001;
          case 'pound': return value * 0.453592;
          case 'ounce': return value * 0.0283495;
          case 'ton': return value * 1000;
        }
        break;
      case 'temperature':
        switch (unit) {
          case 'celsius': return value;
          case 'fahrenheit': return (value - 32) * 5/9;
          case 'kelvin': return value - 273.15;
        }
        break;
      case 'area':
        switch (unit) {
          case 'square meter': return value;
          case 'square kilometer': return value * 1000000;
          case 'square mile': return value * 2589988.11;
          case 'square yard': return value * 0.836127;
          case 'square foot': return value * 0.092903;
          case 'acre': return value * 4046.86;
          case 'hectare': return value * 10000;
        }
        break;
      case 'volume':
        switch (unit) {
          case 'cubic meter': return value;
          case 'liter': return value * 0.001;
          case 'milliliter': return value * 0.000001;
          case 'gallon': return value * 0.00378541;
          case 'quart': return value * 0.000946353;
          case 'pint': return value * 0.000473176;
          case 'cup': return value * 0.000236588;
        }
        break;
      case 'time':
        switch (unit) {
          case 'second': return value;
          case 'minute': return value * 60;
          case 'hour': return value * 3600;
          case 'day': return value * 86400;
          case 'week': return value * 604800;
          case 'month': return value * 2592000; // Approximated as 30 days
          case 'year': return value * 31536000; // Approximated as 365 days
        }
        break;
    }
    return value;
  }
  
  convertFromBaseUnit(baseValue: number, unit: string, type: string): number {
    switch (type) {
      case 'length':
        switch (unit) {
          case 'meter': return baseValue;
          case 'kilometer': return baseValue / 1000;
          case 'centimeter': return baseValue / 0.01;
          case 'millimeter': return baseValue / 0.001;
          case 'mile': return baseValue / 1609.34;
          case 'yard': return baseValue / 0.9144;
          case 'foot': return baseValue / 0.3048;
          case 'inch': return baseValue / 0.0254;
        }
        break;
      case 'weight':
        switch (unit) {
          case 'kilogram': return baseValue;
          case 'gram': return baseValue / 0.001;
          case 'milligram': return baseValue / 0.000001;
          case 'pound': return baseValue / 0.453592;
          case 'ounce': return baseValue / 0.0283495;
          case 'ton': return baseValue / 1000;
        }
        break;
      case 'temperature':
        switch (unit) {
          case 'celsius': return baseValue;
          case 'fahrenheit': return (baseValue * 9/5) + 32;
          case 'kelvin': return baseValue + 273.15;
        }
        break;
      case 'area':
        switch (unit) {
          case 'square meter': return baseValue;
          case 'square kilometer': return baseValue / 1000000;
          case 'square mile': return baseValue / 2589988.11;
          case 'square yard': return baseValue / 0.836127;
          case 'square foot': return baseValue / 0.092903;
          case 'acre': return baseValue / 4046.86;
          case 'hectare': return baseValue / 10000;
        }
        break;
      case 'volume':
        switch (unit) {
          case 'cubic meter': return baseValue;
          case 'liter': return baseValue / 0.001;
          case 'milliliter': return baseValue / 0.000001;
          case 'gallon': return baseValue / 0.00378541;
          case 'quart': return baseValue / 0.000946353;
          case 'pint': return baseValue / 0.000473176;
          case 'cup': return baseValue / 0.000236588;
        }
        break;
      case 'time':
        switch (unit) {
          case 'second': return baseValue;
          case 'minute': return baseValue / 60;
          case 'hour': return baseValue / 3600;
          case 'day': return baseValue / 86400;
          case 'week': return baseValue / 604800;
          case 'month': return baseValue / 2592000; // Approximated as 30 days
          case 'year': return baseValue / 31536000; // Approximated as 365 days
        }
        break;
    }
    return baseValue;
  }
  
  toggleHistory() {
    this.showHistory = !this.showHistory;
  }
  
  clearHistory() {
    this.history = [];
  }

  closePopup() {
    this.dialogRef.close();
  }
}