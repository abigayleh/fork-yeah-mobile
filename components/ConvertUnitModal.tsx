import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { getAvailableTargetUnits, convertQuantity, isCrossTypeConversion } from '../utils/unitConversion';
import { formatQuantityAsFraction } from '../utils/parseQuantity';

type Props = {
  visible: boolean;
  ingredientName: string;
  quantity: number;
  unit: string;
  onClose: () => void;
  onConvert: (unit: string) => void;
};

export default function ConvertUnitModal({ visible, ingredientName, quantity, unit, onClose, onConvert }: Props) {
  const targetUnits = getAvailableTargetUnits(unit, ingredientName);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.card}>
          <Text style={styles.title}>Convert {ingredientName}</Text>
          <Text style={styles.current}>Currently {formatQuantityAsFraction(quantity, unit)} {unit}</Text>

          {targetUnits.map((targetUnit) => {
            const converted = convertQuantity(quantity, unit, targetUnit, ingredientName);
            if (converted === null) return null;

            return (
              <TouchableOpacity key={targetUnit} style={styles.option} onPress={() => onConvert(targetUnit)}>
                <Text style={styles.optionText}>
                  {formatQuantityAsFraction(converted, targetUnit)} {targetUnit}
                  {isCrossTypeConversion(unit, targetUnit) && <Text style={styles.approx}> (approx.)</Text>}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', maxWidth: 380 },
  title: { fontSize: 18, fontWeight: '800', color: '#115e59', marginBottom: 4 },
  current: { color: '#5e6a63', marginBottom: 14 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0ebe0' },
  optionText: { color: '#1f2421', fontWeight: '600', fontSize: 15 },
  approx: { color: '#9ca3af', fontWeight: '400', fontSize: 13 },
  cancelBtn: { marginTop: 14, alignItems: 'center' },
  cancelText: { color: '#5e6a63', fontWeight: '700' },
});
